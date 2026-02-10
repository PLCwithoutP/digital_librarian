
import React, { useState, useEffect } from 'react';
import { Article, ArticleMetadata, Note } from '../types';
import { getFileFromDB } from '../db';

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
    }
  }, [article]);

  useEffect(() => () => { if (pdfUrl) URL.revokeObjectURL(pdfUrl); }, [pdfUrl]);

  if (!article) return <div className={`fixed inset-y-0 right-0 w-[450px] bg-white dark:bg-slate-900 shadow-2xl transform transition-transform duration-300 ease-in-out border-l border-slate-200 dark:border-slate-800 flex flex-col z-20 translate-x-full`}></div>;

  const handleExportCitation = () => {
    const { key, bib } = generateBibtexEntry(article);
    const m = article.metadata!;
    const entry = {
      file_path: article.filePath || article.fileName,
      file_name: article.fileName,
      title: m.title || "",
      authors: m.authors || [],
      year: parseInt(String(m.year)) || null,
      journal: m.journal || "",
      volume: m.volume || null,
      number: m.number || null,
      pages: m.pages || null,
      doi: m.doi || "",
      url: m.url || "",
      bibtex_type: "misc",
      bibtex_key: key,
      bibtex: bib
    };

    const exportData = {
      root_path: article.filePath?.split('/')[0] || "Librarian Library",
      source_parsed_json: "parsed_pdfs.json",
      generated_at: new Date().toISOString().split('.')[0],
      bibtex_count: 1,
      entries: [entry]
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bibtex_pdfs.json';
    a.click();
    URL.revokeObjectURL(url);
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
                    <div className="pt-8 border-t border-slate-100 dark:border-slate-800 space-y-4">
                        <button onClick={handleExportCitation} className="w-full py-2 text-sm bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium rounded hover:bg-slate-200 border border-slate-200 dark:border-slate-700 transition-colors">Export Citation</button>
                        <button onClick={async () => { setIsLoadingPdf(true); const b = await getFileFromDB(article.id); if(b) setPdfUrl(URL.createObjectURL(b)); setIsLoadingPdf(false); }} disabled={isLoadingPdf} className="w-full py-3 bg-indigo-600 text-white font-bold rounded-lg shadow-md">{isLoadingPdf ? "Loading..." : "Read PDF"}</button>
                    </div>
                </div>
            </div>
            {pdfUrl && (<div className="flex-1 bg-slate-200 dark:bg-slate-800 h-full relative flex flex-col"><iframe src={pdfUrl} className="w-full h-full border-none" /></div>)}
        </div>
    </div>
  );
};
