
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Article, ArticleMetadata, Note } from '../types';
import ReactMarkdown from 'react-markdown';

interface ArticleDetailProps {
  article: Article | null | undefined;
  notes?: Note[];
  onClose: () => void;
  onUpdateMetadata: (id: string, updates: Partial<ArticleMetadata>) => void;
  onEditNote: (note: Note) => void;
  onOpenNote: (note: Note) => void;
  onDeleteNote: (id: string) => void;
  getPDF: (id: string) => File | undefined;
}

const getCategoryStyle = (category: string) => {
  if (category === 'Uncategorized') return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700';
  const styles = [
    'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300 border-red-100 dark:border-red-900/50',
    'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-blue-100 dark:border-blue-900/50',
    'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300 border-green-100 dark:border-green-900/50',
    'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 border-indigo-100 dark:border-indigo-900/50',
  ];
  let hash = 0;
  for (let i = 0; i < category.length; i++) hash = category.charCodeAt(i) + ((hash << 5) - hash);
  return styles[Math.abs(hash) % styles.length];
};

export const ArticleDetail: React.FC<ArticleDetailProps> = ({ 
  article, notes = [], onClose, onUpdateMetadata, onEditNote, onOpenNote, onDeleteNote, getPDF
}) => {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState('');
  const [isEditingAuthors, setIsEditingAuthors] = useState(false);
  const [authorsInput, setAuthorsInput] = useState('');
  const [isEditingJournal, setIsEditingJournal] = useState(false);
  const [journalInput, setJournalInput] = useState('');
  const [isEditingYear, setIsEditingYear] = useState(false);
  const [yearInput, setYearInput] = useState('');
  const [isEditingVolume, setIsEditingVolume] = useState(false);
  const [volumeInput, setVolumeInput] = useState('');
  const [isEditingNumber, setIsEditingNumber] = useState(false);
  const [numberInput, setNumberInput] = useState('');
  const [isEditingPages, setIsEditingPages] = useState(false);
  const [pagesInput, setPagesInput] = useState('');
  const [isEditingDoi, setIsEditingDoi] = useState(false);
  const [doiInput, setDoiInput] = useState('');
  const [isEditingUrl, setIsEditingUrl] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [isEditingAbstract, setIsEditingAbstract] = useState(false);
  const [abstractInput, setAbstractInput] = useState('');
  
  const [newCategory, setNewCategory] = useState('');
  const [newKeyword, setNewKeyword] = useState('');

  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);
  
  const activeArticleIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (article) {
        if (article.id !== activeArticleIdRef.current) {
            setPdfUrl(null);
            activeArticleIdRef.current = article.id;
        }

        if (!isEditingTitle) setTitleInput(article.metadata?.title || article.fileName);
        if (!isEditingAuthors) setAuthorsInput(article.metadata?.authors?.join(', ') || '');
        if (!isEditingJournal) setJournalInput(article.metadata?.journal || '');
        if (!isEditingYear) setYearInput(article.metadata?.year || '');
        if (!isEditingVolume) setVolumeInput(article.metadata?.volume || '');
        if (!isEditingNumber) setNumberInput(String(article.metadata?.number || ''));
        if (!isEditingPages) setPagesInput(article.metadata?.pages || '');
        if (!isEditingDoi) setDoiInput(article.metadata?.doi || '');
        if (!isEditingUrl) setUrlInput(article.metadata?.url || '');
        if (!isEditingAbstract) setAbstractInput(article.metadata?.abstract || '');
    }
  }, [article, isEditingTitle, isEditingAuthors, isEditingJournal, isEditingYear, isEditingVolume, isEditingNumber, isEditingPages, isEditingDoi, isEditingUrl, isEditingAbstract]);

  useEffect(() => () => { if (pdfUrl) URL.revokeObjectURL(pdfUrl); }, [pdfUrl]);

  const articleNotes = useMemo(() => {
    if (!article) return [];
    return notes.filter(n => n.type === 'article' && n.targetId === article.id);
  }, [notes, article]);

  if (!article) return null;

  const handleLoadPdf = () => {
    setIsLoadingPdf(true);
    const file = getPDF(article.id);
    if (file) {
        if (pdfUrl) URL.revokeObjectURL(pdfUrl);
        const blob = new Blob([file], { type: 'application/pdf' });
        setPdfUrl(URL.createObjectURL(blob));
    } else {
        alert("File link missing! Please 'Add Folder' or 'Add PDF' to re-link your local PDF files.");
    }
    setIsLoadingPdf(false);
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

  const EditableField = ({ label, value, isEditing, setIsEditing, inputValue, setInputValue, onSave, multiline = false, w = "w-16" }: any) => (
    <div className="text-sm flex gap-2">
      <span className={`font-semibold shrink-0 text-slate-500 ${w}`}>{label}:</span>
      {isEditing ? (
        multiline ? (
          <textarea 
            autoFocus 
            className="flex-1 bg-slate-50 dark:bg-slate-800 border-2 border-indigo-500 rounded p-1 text-sm text-slate-900 dark:text-slate-100 outline-none min-h-[100px]" 
            value={inputValue} 
            onChange={e => setInputValue(e.target.value)} 
            onBlur={() => { onSave(); setIsEditing(false); }} 
          />
        ) : (
          <input 
            autoFocus 
            className="flex-1 bg-slate-50 dark:bg-slate-800 border-b-2 border-indigo-500 outline-none text-sm text-slate-900 dark:text-slate-100 px-1" 
            value={inputValue} 
            onChange={e => setInputValue(e.target.value)} 
            onBlur={() => { onSave(); setIsEditing(false); }} 
          />
        )
      ) : (
        <span className="flex-1 cursor-pointer hover:text-indigo-600 transition-colors break-words text-slate-800 dark:text-slate-200" onClick={() => setIsEditing(true)}>
            {value || <span className="text-slate-400 italic">Empty</span>}
        </span>
      )}
    </div>
  );

  return (
    <div className={`fixed inset-y-0 right-0 ${pdfUrl ? 'w-[94vw]' : 'w-[450px]'} bg-white dark:bg-slate-900 shadow-2xl transition-all duration-300 border-l border-slate-200 dark:border-slate-800 flex flex-col z-20`}>
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900 shrink-0">
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500">Metadata</h2>
            <div className="flex items-center gap-2">
                {pdfUrl && <button onClick={() => setPdfUrl(null)} className="text-xs px-3 py-1 bg-slate-200 dark:bg-slate-700 rounded text-slate-700 dark:text-slate-200 hover:bg-slate-300 transition-colors">Close Reader</button>}
                <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
        </div>
        <div className="flex-1 flex overflow-hidden">
            <div className={`flex-1 overflow-y-auto p-8 bg-white dark:bg-slate-900 ${pdfUrl ? 'max-w-[420px] border-r border-slate-200 dark:border-slate-800' : ''}`}>
                <div className="space-y-6">
                    <header>
                        {isEditingTitle ? (
                           <textarea autoFocus className="w-full text-xl font-bold bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 border-2 border-indigo-500 rounded p-2 focus:outline-none" value={titleInput} onChange={e => setTitleInput(e.target.value)} onBlur={() => { onUpdateMetadata(article.id, { title: titleInput }); setIsEditingTitle(false); }} />
                        ) : (
                           <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2 cursor-pointer hover:text-indigo-600 leading-tight" onClick={() => setIsEditingTitle(true)}>{article.metadata?.title || article.fileName}</h3>
                        )}
                        <div className="space-y-3 mt-6">
                            <EditableField label="Authors" value={article.metadata?.authors?.join(', ')} isEditing={isEditingAuthors} setIsEditing={setIsEditingAuthors} inputValue={authorsInput} setInputValue={setAuthorsInput} onSave={() => onUpdateMetadata(article.id, { authors: authorsInput.split(/[,;]/).map(s => s.trim()).filter(x => x) })} />
                            <EditableField label="Journal" value={article.metadata?.journal} isEditing={isEditingJournal} setIsEditing={setIsEditingJournal} inputValue={journalInput} setInputValue={setJournalInput} onSave={() => onUpdateMetadata(article.id, { journal: journalInput })} />
                            <div className="grid grid-cols-2 gap-4">
                                <EditableField label="Year" value={article.metadata?.year} isEditing={isEditingYear} setIsEditing={setIsEditingYear} inputValue={yearInput} setInputValue={setYearInput} onSave={() => onUpdateMetadata(article.id, { year: yearInput })} />
                                <EditableField label="Volume" value={article.metadata?.volume} isEditing={isEditingVolume} setIsEditing={setIsEditingVolume} inputValue={volumeInput} setInputValue={setVolumeInput} onSave={() => onUpdateMetadata(article.id, { volume: volumeInput })} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <EditableField label="Issue" value={article.metadata?.number} isEditing={isEditingNumber} setIsEditing={setIsEditingNumber} inputValue={numberInput} setInputValue={setNumberInput} onSave={() => onUpdateMetadata(article.id, { number: numberInput })} />
                                <EditableField label="Pages" value={article.metadata?.pages} isEditing={isEditingPages} setIsEditing={setIsEditingPages} inputValue={pagesInput} setInputValue={setPagesInput} onSave={() => onUpdateMetadata(article.id, { pages: pagesInput })} />
                            </div>
                            <EditableField label="DOI" value={article.metadata?.doi} isEditing={isEditingDoi} setIsEditing={setIsEditingDoi} inputValue={doiInput} setInputValue={setDoiInput} onSave={() => onUpdateMetadata(article.id, { doi: doiInput })} />
                            <EditableField label="URL" value={article.metadata?.url} isEditing={isEditingUrl} setIsEditing={setIsEditingUrl} inputValue={urlInput} setInputValue={setUrlInput} onSave={() => onUpdateMetadata(article.id, { url: urlInput })} />
                            <EditableField label="Abstract" value={article.metadata?.abstract} isEditing={isEditingAbstract} setIsEditing={setIsEditingAbstract} inputValue={abstractInput} setInputValue={setAbstractInput} multiline onSave={() => onUpdateMetadata(article.id, { abstract: abstractInput })} />
                        </div>
                    </header>

                    {/* Categories Section */}
                    <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
                        <h4 className="text-xs font-bold uppercase text-slate-500 mb-3 tracking-widest">Categories</h4>
                        <div className="flex flex-wrap gap-2 mb-3">
                            {article.metadata?.categories.map(cat => (
                                <span key={cat} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium border shadow-sm ${getCategoryStyle(cat)}`}>
                                    {cat}
                                    <button onClick={() => handleRemoveCategory(cat)} className="hover:text-red-500 transition-colors">
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                </span>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <input 
                                type="text" 
                                placeholder="Add category..." 
                                className="flex-1 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1.5 text-slate-900 dark:text-slate-100 outline-none focus:ring-1 focus:ring-indigo-500"
                                value={newCategory}
                                onChange={(e) => setNewCategory(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
                            />
                            <button onClick={handleAddCategory} className="px-3 py-1 bg-indigo-600 text-white rounded text-xs font-bold hover:bg-indigo-700">Add</button>
                        </div>
                    </div>

                    {/* Keywords Section */}
                    <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
                        <h4 className="text-xs font-bold uppercase text-slate-500 mb-3 tracking-widest">Keywords</h4>
                        <div className="flex flex-wrap gap-1.5 mb-3">
                            {article.metadata?.keywords?.length ? article.metadata.keywords.map(kw => (
                                <span key={kw} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] border border-slate-200 dark:border-slate-700">
                                    {kw}
                                    <button onClick={() => handleRemoveKeyword(kw)} className="hover:text-red-500 transition-colors">
                                        <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                </span>
                            )) : <span className="text-xs italic text-slate-400">No keywords</span>}
                        </div>
                        <div className="flex gap-2">
                            <input 
                                type="text" 
                                placeholder="Add keyword..." 
                                className="flex-1 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1.5 text-slate-900 dark:text-slate-100 outline-none focus:ring-1 focus:ring-indigo-500"
                                value={newKeyword}
                                onChange={(e) => setNewKeyword(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleAddKeyword()}
                            />
                            <button onClick={handleAddKeyword} className="px-3 py-1 bg-slate-700 text-white rounded text-xs font-bold hover:bg-slate-600">Add</button>
                        </div>
                    </div>

                    <div className="pt-6 space-y-2">
                        <button onClick={handleLoadPdf} disabled={isLoadingPdf} className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                            {isLoadingPdf ? "Loading..." : "Read PDF"}
                        </button>
                    </div>

                    {/* Notes Section */}
                    <div className="pt-8 border-t border-slate-100 dark:border-slate-800 pb-10">
                        <div className="flex items-center justify-between mb-4">
                            <h4 className="text-xs font-bold uppercase text-slate-500 tracking-widest">Linked Notes</h4>
                            <button onClick={() => onEditNote({ id: '', title: `Note on ${article.metadata?.title || article.fileName}`, content: '', type: 'article', targetId: article.id, createdAt: Date.now() })} className="text-xs text-indigo-600 font-bold hover:underline">+ New Note</button>
                        </div>
                        {articleNotes.length === 0 ? (
                            <p className="text-xs italic text-slate-400">No notes yet.</p>
                        ) : (
                            articleNotes.map(note => (
                                <div key={note.id} className="p-4 mb-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 group transition-all hover:border-indigo-300 dark:hover:border-indigo-900">
                                    <h5 className="text-sm font-bold mb-1 text-slate-800 dark:text-slate-200 cursor-pointer hover:text-indigo-600 transition-colors" onClick={() => onOpenNote(note)}>{note.title}</h5>
                                    <div className="text-xs line-clamp-2 text-slate-600 dark:text-slate-400 prose prose-xs dark:prose-invert"><ReactMarkdown>{note.content}</ReactMarkdown></div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
            {pdfUrl && (
              <div className="flex-1 bg-slate-200 h-full relative border-l border-slate-300 dark:border-slate-700">
                <object 
                    data={pdfUrl} 
                    type="application/pdf" 
                    className="w-full h-full"
                >
                    <div className="flex flex-col items-center justify-center h-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 p-12 text-center">
                        <svg className="w-16 h-16 mb-4 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                        <p className="font-bold mb-2">PDF Viewer Blocked</p>
                        <p className="text-sm mb-6">Chrome or your browser settings might be blocking local PDF previews.</p>
                        <a href={pdfUrl} target="_blank" rel="noreferrer" className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold shadow-md hover:bg-indigo-700 transition-colors">Open in New Tab</a>
                    </div>
                </object>
              </div>
            )}
        </div>
    </div>
  );
};
