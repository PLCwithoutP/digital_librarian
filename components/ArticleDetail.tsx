
import React, { useState, useEffect, useMemo } from 'react';
import { Article, ArticleMetadata, Note } from '../types';
import { getFileFromDB } from '../db';
import ReactMarkdown from 'react-markdown';

interface ArticleDetailProps {
  article: Article | null | undefined;
  notes?: Note[];
  onClose: () => void;
  onUpdateMetadata: (id: string, updates: Partial<ArticleMetadata>) => void;
  onEditNote: (note: Note) => void;
  onOpenNote: (note: Note) => void;
  onDeleteNote: (id: string) => void;
  onReplacePdf: (id: string, file: File) => Promise<void>;
}

const getCategoryStyle = (category: string) => {
  if (category === 'Uncategorized') return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700';
  
  const styles = [
    'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300 border-red-100 dark:border-red-900/50',
    'bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 border-orange-100 dark:border-orange-900/50',
    'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-amber-100 dark:border-amber-900/50',
    'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300 border-green-100 dark:border-green-900/50',
    'bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300 border-teal-100 dark:border-teal-900/50',
    'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-blue-100 dark:border-blue-900/50',
    'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 border-indigo-100 dark:border-indigo-900/50',
    'bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300 border-violet-100 dark:border-violet-900/50',
    'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 border-purple-100 dark:border-purple-900/50',
    'bg-pink-50 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300 border-pink-100 dark:border-pink-900/50',
    'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300 border-rose-100 dark:border-rose-900/50',
  ];
  
  let hash = 0;
  for (let i = 0; i < category.length; i++) {
    hash = category.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % styles.length;
  return styles[index];
};

// Key generation helper
const generateBibtexEntry = (art: Article) => {
  const m = art.metadata!;
  const year = m.year && m.year !== "Unknown" ? m.year : "0000";
  const authors = m.authors || [];
  let lastName = "anon";
  if (authors.length > 0) {
    const parts = authors[0].split(' ');
    lastName = parts[parts.length - 1].toLowerCase().replace(/[^a-z0-9]/g, '');
  }
  const titleWords = (m.title || "").split(/\s+/).filter(w => w.length > 3);
  const firstTitleWord = (titleWords[0] || "entry").toLowerCase().replace(/[^a-z0-9]/g, '');
  const bibKey = `${lastName}${year}${firstTitleWord}`;
  
  const authorsStr = authors.join(' and ');
  let bib = `@misc{${bibKey},\n`;
  if (authorsStr) bib += `  author = {${authorsStr}},\n`;
  bib += `  title = {${m.title || ""}},\n`;
  bib += `  year = {${year}},\n`;
  if (m.journal) bib += `  journal = {${m.journal}},\n`;
  if (m.volume) bib += `  volume = {${m.volume}},\n`;
  if (m.number) bib += `  number = {${m.number}},\n`;
  if (m.pages) bib += `  pages = {${m.pages}},\n`;
  if (m.doi) bib += `  doi = {${m.doi}},\n`;
  if (m.url) bib += `  url = {${m.url}},\n`;
  bib += `  howpublished = {PDF},\n`;
  bib += `  note = {Local PDF: ${art.fileName}},\n`;
  bib += `  file = {${art.filePath || art.fileName}}\n`;
  bib += `}`;
  
  return { key: bibKey, bib };
};

export const ArticleDetail: React.FC<ArticleDetailProps> = ({ 
  article, notes = [], onClose, onUpdateMetadata, onEditNote, onOpenNote, onDeleteNote, onReplacePdf
}) => {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState('');
  const [isEditingAuthors, setIsEditingAuthors] = useState(false);
  const [authorsInput, setAuthorsInput] = useState('');
  const [isEditingJournal, setIsEditingJournal] = useState(false);
  const [journalInput, setJournalInput] = useState('');
  const [isEditingVolume, setIsEditingVolume] = useState(false);
  const [volumeInput, setVolumeInput] = useState('');
  const [isEditingNumber, setIsEditingNumber] = useState(false);
  const [numberInput, setNumberInput] = useState('');
  const [isEditingYear, setIsEditingYear] = useState(false);
  const [yearInput, setYearInput] = useState('');
  const [isEditingDoi, setIsEditingDoi] = useState(false);
  const [doiInput, setDoiInput] = useState('');
  const [isEditingPages, setIsEditingPages] = useState(false);
  const [pagesInput, setPagesInput] = useState('');
  
  const [newCategory, setNewCategory] = useState('');
  const [newKeyword, setNewKeyword] = useState('');

  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);

  useEffect(() => {
    if (article) {
        setTitleInput(article.metadata?.title || article.fileName);
        setAuthorsInput(article.metadata?.authors?.join(', ') || '');
        setJournalInput(article.metadata?.journal || '');
        setVolumeInput(article.metadata?.volume || '');
        setNumberInput(String(article.metadata?.number || ''));
        setYearInput(article.metadata?.year || '');
        setDoiInput(article.metadata?.doi || '');
        setPagesInput(article.metadata?.pages || '');
        
        setIsEditingTitle(false); setIsEditingAuthors(false); setIsEditingJournal(false); setIsEditingVolume(false); setIsEditingNumber(false);
        setIsEditingYear(false); setIsEditingDoi(false); setIsEditingPages(false);
        setPdfUrl(null);
        setNewCategory('');
        setNewKeyword('');
    }
  }, [article]);

  useEffect(() => () => { if (pdfUrl) URL.revokeObjectURL(pdfUrl); }, [pdfUrl]);

  const articleNotes = useMemo(() => {
    if (!article) return [];
    return notes.filter(n => n.type === 'article' && n.targetId === article.id);
  }, [notes, article]);

  if (!article) return <div className={`fixed inset-y-0 right-0 w-[450px] bg-white dark:bg-slate-900 shadow-2xl transform transition-transform duration-300 ease-in-out border-l border-slate-200 dark:border-slate-800 flex flex-col z-20 translate-x-full`}></div>;

  const handleExportCitation = () => {
    const { key, bib } = generateBibtexEntry(article);
    const blob = new Blob([bib], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${key}.bib`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportNotes = () => {
    if (!articleNotes.length) {
      alert("No notes found for this article.");
      return;
    }
    const title = article.metadata?.title || article.fileName;
    let content = `# Notes for: ${title}\n\n`;
    articleNotes.forEach(n => {
      content += `## ${n.title}\n*Created: ${new Date(n.createdAt).toLocaleDateString()}*\n\n${n.content}\n\n---\n\n`;
    });
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.slice(0, 30).replace(/[^a-z0-9]/gi, '_')}_notes.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleAddCategory = () => {
    if (!newCategory.trim()) return;
    const current = article.metadata?.categories || [];
    if (!current.includes(newCategory.trim())) {
      onUpdateMetadata(article.id, { categories: [...current, newCategory.trim()] });
    }
    setNewCategory('');
  };

  const handleRemoveCategory = (cat: string) => {
    const current = article.metadata?.categories || [];
    onUpdateMetadata(article.id, { categories: current.filter(c => c !== cat) });
  };

  const handleAddKeyword = () => {
    if (!newKeyword.trim()) return;
    const current = article.metadata?.keywords || [];
    if (!current.includes(newKeyword.trim())) {
      onUpdateMetadata(article.id, { keywords: [...current, newKeyword.trim()] });
    }
    setNewKeyword('');
  };

  const handleRemoveKeyword = (kw: string) => {
    const current = article.metadata?.keywords || [];
    onUpdateMetadata(article.id, { keywords: current.filter(k => k !== kw) });
  };

  return (
    <div className={`fixed inset-y-0 right-0 ${pdfUrl ? 'w-[90vw] md:w-[85vw]' : 'w-[450px]'} bg-white dark:bg-slate-900 shadow-2xl transform transition-all duration-300 ease-in-out border-l border-slate-200 dark:border-slate-800 flex flex-col z-20 translate-x-0`}>
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900 shrink-0">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Article Details</h2>
            <div className="flex items-center gap-2">
                {pdfUrl && (<><button onClick={async () => { const b = await getFileFromDB(article.id); if(b) { const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href = u; a.download = article.fileName; a.click(); URL.revokeObjectURL(u); }}} className="text-xs px-3 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-700 dark:text-slate-200 shadow-sm">Download</button><button onClick={() => setPdfUrl(null)} className="text-xs px-3 py-1 bg-slate-200 dark:bg-slate-700 rounded text-slate-700 dark:text-slate-200">Close Reader</button></>)}
                <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
        </div>
        <div className="flex-1 flex overflow-hidden">
            <div className={`flex-1 overflow-y-auto p-8 bg-white dark:bg-slate-900 ${pdfUrl ? 'max-w-[400px] border-r border-slate-200 dark:border-slate-800' : ''}`}>
                <div className="space-y-8">
                    <header>
                        {isEditingTitle ? (<div className="mb-4"><textarea className="w-full text-2xl font-serif font-bold leading-tight text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 border-2 border-indigo-500 rounded p-2 focus:outline-none resize-none" value={titleInput} onChange={(e) => setTitleInput(e.target.value)} onBlur={() => { onUpdateMetadata(article.id, { title: titleInput.trim() || article.fileName }); setIsEditingTitle(false); }} autoFocus rows={3} /></div>) : (<h3 className="text-2xl font-serif font-bold leading-tight text-slate-900 dark:text-slate-100 mb-4 cursor-pointer hover:text-indigo-600 transition-colors" onClick={() => setIsEditingTitle(true)}>{article.metadata?.title || article.fileName}</h3>)}
                        <div className="space-y-3">
                            <div className="flex gap-2 text-sm">
                                <span className="font-semibold text-slate-500 dark:text-slate-400 w-16 pt-1">Authors:</span>
                                {isEditingAuthors ? (<textarea className="flex-1 text-sm text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-indigo-500 rounded p-1 focus:outline-none resize-none" value={authorsInput} onChange={(e) => setAuthorsInput(e.target.value)} onBlur={() => { onUpdateMetadata(article.id, { authors: authorsInput.split(/[,;]/).map(x => x.trim()).filter(x => x) }); setIsEditingAuthors(false); }} autoFocus rows={2} />) : (<span className="text-slate-700 dark:text-slate-300 flex-1 cursor-pointer hover:text-indigo-600" onClick={() => setIsEditingAuthors(true)}>{article.metadata?.authors?.join(', ') || 'Empty'}</span>)}
                            </div>
                            <div className="flex gap-2 text-sm">
                                <span className="font-semibold text-slate-500 dark:text-slate-400 w-16 pt-1">Journal:</span>
                                {isEditingJournal ? (<input className="flex-1 text-sm text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-indigo-500 rounded p-1" value={journalInput} onChange={(e) => setJournalInput(e.target.value)} onBlur={() => { onUpdateMetadata(article.id, { journal: journalInput.trim() }); setIsEditingJournal(false); }} autoFocus />) : (<span className="text-slate-700 dark:text-slate-300 flex-1 cursor-pointer hover:text-indigo-600" onClick={() => setIsEditingJournal(true)}>{article.metadata?.journal || '-'}</span>)}
                            </div>
                            <div className="flex gap-2 text-sm">
                                <span className="font-semibold text-slate-500 dark:text-slate-400 w-16 pt-1">Volume:</span>
                                {isEditingVolume ? (<input className="flex-1 text-sm text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-indigo-500 rounded p-1" value={volumeInput} onChange={(e) => setVolumeInput(e.target.value)} onBlur={() => { onUpdateMetadata(article.id, { volume: volumeInput.trim() }); setIsEditingVolume(false); }} autoFocus />) : (<span className="text-slate-700 dark:text-slate-300 flex-1 cursor-pointer hover:text-indigo-600" onClick={() => setIsEditingVolume(true)}>{article.metadata?.volume || '-'}</span>)}
                            </div>
                            <div className="flex gap-2 text-sm">
                                <span className="font-semibold text-slate-500 dark:text-slate-400 w-16 pt-1">Number:</span>
                                {isEditingNumber ? (<input className="flex-1 text-sm text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-indigo-500 rounded p-1" value={numberInput} onChange={(e) => setNumberInput(e.target.value)} onBlur={() => { onUpdateMetadata(article.id, { number: numberInput.trim() || null }); setIsEditingNumber(false); }} autoFocus />) : (<span className="text-slate-700 dark:text-slate-300 flex-1 cursor-pointer hover:text-indigo-600" onClick={() => setIsEditingNumber(true)}>{article.metadata?.number || '-'}</span>)}
                            </div>
                            <div className="flex gap-2 text-sm">
                                <span className="font-semibold text-slate-500 dark:text-slate-400 w-16 pt-1">Pages:</span>
                                {isEditingPages ? (<input className="flex-1 text-sm text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-indigo-500 rounded p-1" value={pagesInput} onChange={(e) => setPagesInput(e.target.value)} onBlur={() => { onUpdateMetadata(article.id, { pages: pagesInput.trim() }); setIsEditingPages(false); }} autoFocus />) : (<span className="text-slate-700 dark:text-slate-300 flex-1 cursor-pointer hover:text-indigo-600" onClick={() => setIsEditingPages(true)}>{article.metadata?.pages || '-'}</span>)}
                            </div>
                            <div className="flex gap-2 text-sm">
                                <span className="font-semibold text-slate-500 dark:text-slate-400 w-16 pt-1">Year:</span>
                                {isEditingYear ? (<input className="flex-1 text-sm text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-indigo-500 rounded p-1" value={yearInput} onChange={(e) => setYearInput(e.target.value)} onBlur={() => { onUpdateMetadata(article.id, { year: yearInput.trim() || 'Unknown' }); setIsEditingYear(false); }} autoFocus />) : (<span className="text-slate-700 dark:text-slate-300 flex-1 cursor-pointer hover:text-indigo-600" onClick={() => setIsEditingYear(true)}>{article.metadata?.year || 'Unknown'}</span>)}
                            </div>
                            <div className="flex gap-2 text-sm">
                                <span className="font-semibold text-slate-500 dark:text-slate-400 w-16 pt-1">DOI:</span>
                                {isEditingDoi ? (<input className="flex-1 text-sm text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-indigo-500 rounded p-1" value={doiInput} onChange={(e) => setDoiInput(e.target.value)} onBlur={() => { onUpdateMetadata(article.id, { doi: doiInput.trim() }); setIsEditingDoi(false); }} autoFocus />) : (<span className="text-slate-700 dark:text-slate-300 flex-1 cursor-pointer hover:text-indigo-600 break-all" onClick={() => setIsEditingDoi(true)}>{article.metadata?.doi || '-'}</span>)}
                            </div>
                        </div>
                    </header>

                    {/* Labels / Categories Section */}
                    <div className="pt-8 border-t border-slate-100 dark:border-slate-800">
                        <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-4">Categories & Labels</h4>
                        <div className="flex flex-wrap gap-2 mb-4">
                            {article.metadata?.categories?.length ? article.metadata.categories.map(cat => (
                                <span key={cat} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium border shadow-sm ${getCategoryStyle(cat)}`}>
                                    {cat}
                                    <button onClick={() => handleRemoveCategory(cat)} className="hover:text-red-500 transition-colors">
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                </span>
                            )) : (
                                <span className="text-xs italic text-slate-400">No categories assigned.</span>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <input 
                                type="text" 
                                placeholder="Add category..." 
                                className="flex-1 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1.5 outline-none focus:ring-1 focus:ring-indigo-500"
                                value={newCategory}
                                onChange={(e) => setNewCategory(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
                            />
                            <button onClick={handleAddCategory} className="px-3 py-1 bg-indigo-600 text-white rounded text-xs font-bold hover:bg-indigo-700 transition-colors">Add</button>
                        </div>
                    </div>

                    {/* Keywords Section */}
                    <div className="pt-8 border-t border-slate-100 dark:border-slate-800">
                        <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-4">Keywords</h4>
                        <div className="flex flex-wrap gap-1.5 mb-4">
                            {article.metadata?.keywords?.length ? article.metadata.keywords.map(kw => (
                                <span key={kw} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] border border-slate-200 dark:border-slate-700">
                                    {kw}
                                    <button onClick={() => handleRemoveKeyword(kw)} className="hover:text-red-500 transition-colors">
                                        <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                </span>
                            )) : (
                                <span className="text-xs italic text-slate-400">No keywords defined.</span>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <input 
                                type="text" 
                                placeholder="Add keyword..." 
                                className="flex-1 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1.5 outline-none focus:ring-1 focus:ring-indigo-500"
                                value={newKeyword}
                                onChange={(e) => setNewKeyword(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleAddKeyword()}
                            />
                            <button onClick={handleAddKeyword} className="px-3 py-1 bg-slate-700 text-white rounded text-xs font-bold hover:bg-slate-600 transition-colors">Add</button>
                        </div>
                    </div>

                    <div className="pt-8 border-t border-slate-100 dark:border-slate-800 space-y-4">
                        <div className="grid grid-cols-2 gap-2">
                          <button onClick={handleExportCitation} className="py-2 text-xs bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium rounded hover:bg-slate-200 border border-slate-200 dark:border-slate-700 transition-colors">Export Citation (.bib)</button>
                          <button onClick={handleExportNotes} className="py-2 text-xs bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium rounded hover:bg-slate-200 border border-slate-200 dark:border-slate-700 transition-colors">Export Notes (.md)</button>
                        </div>
                        <button onClick={async () => { setIsLoadingPdf(true); const b = await getFileFromDB(article.id); if(b) setPdfUrl(URL.createObjectURL(b)); setIsLoadingPdf(false); }} disabled={isLoadingPdf} className="w-full py-3 bg-indigo-600 text-white font-bold rounded-lg shadow-md">{isLoadingPdf ? "Loading..." : "Read PDF"}</button>
                    </div>

                    {/* Notes Section */}
                    <div className="pt-8 border-t border-slate-100 dark:border-slate-800 pb-12">
                        <div className="flex items-center justify-between mb-4">
                            <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Article Notes</h4>
                            <button 
                                onClick={() => onEditNote({ id: '', title: `Note on ${article.metadata?.title || article.fileName}`, content: '', type: 'article', targetId: article.id, createdAt: Date.now() })}
                                className="p-1.5 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-full transition-colors"
                                title="Add New Note"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                            </button>
                        </div>
                        
                        <div className="space-y-3">
                            {articleNotes.length === 0 ? (
                                <p className="text-xs italic text-slate-400 dark:text-slate-500 text-center py-4">No notes for this article yet.</p>
                            ) : (
                                articleNotes.map(note => (
                                    <div key={note.id} className="group p-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                                        <div className="flex items-start justify-between mb-1">
                                            <h5 className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate pr-2 cursor-pointer hover:text-indigo-600" onClick={() => onOpenNote(note)}>{note.title}</h5>
                                            <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity gap-1">
                                                <button onClick={() => onEditNote(note)} className="p-1 text-slate-400 hover:text-indigo-600"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg></button>
                                                <button onClick={() => onDeleteNote(note.id)} className="p-1 text-slate-400 hover:text-red-600"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                                            </div>
                                        </div>
                                        <div className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 prose prose-xs dark:prose-invert pointer-events-none">
                                            <ReactMarkdown>{note.content}</ReactMarkdown>
                                        </div>
                                        <div className="text-[10px] text-slate-400 dark:text-slate-600 mt-2">
                                            {new Date(note.createdAt).toLocaleDateString()}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
            {pdfUrl && (<div className="flex-1 bg-slate-200 dark:bg-slate-800 h-full relative flex flex-col"><iframe src={pdfUrl} className="w-full h-full border-none" /></div>)}
        </div>
    </div>
  );
};
