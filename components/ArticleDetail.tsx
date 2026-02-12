
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
  
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);
  
  // Track the actual ID we are viewing to prevent resetting when metadata changes
  const activeArticleIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (article) {
        // Only reset high-level UI states if we switched to a DIFFERENT article ID
        if (article.id !== activeArticleIdRef.current) {
            setPdfUrl(null);
            setIsEditingTitle(false);
            setIsEditingAuthors(false);
            setIsEditingJournal(false);
            activeArticleIdRef.current = article.id;
        }

        // Always sync inputs if not currently editing a field
        if (!isEditingTitle) setTitleInput(article.metadata?.title || article.fileName);
        if (!isEditingAuthors) setAuthorsInput(article.metadata?.authors?.join(', ') || '');
        if (!isEditingJournal) setJournalInput(article.metadata?.journal || '');
    }
  }, [article, isEditingTitle, isEditingAuthors, isEditingJournal]);

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
        setPdfUrl(URL.createObjectURL(file));
    } else {
        alert("Local file not linked in current session. Please use 'Add Folder' to link your local PDF files.");
    }
    setIsLoadingPdf(false);
  };

  return (
    <div className={`fixed inset-y-0 right-0 ${pdfUrl ? 'w-[90vw]' : 'w-[450px]'} bg-white dark:bg-slate-900 shadow-2xl transition-all duration-300 border-l border-slate-200 dark:border-slate-800 flex flex-col z-20`}>
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900 shrink-0">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">Details</h2>
            <div className="flex items-center gap-2">
                {pdfUrl && <button onClick={() => setPdfUrl(null)} className="text-xs px-3 py-1 bg-slate-200 dark:bg-slate-700 rounded text-slate-700 dark:text-slate-200">Close Reader</button>}
                <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
        </div>
        <div className="flex-1 flex overflow-hidden">
            <div className={`flex-1 overflow-y-auto p-8 bg-white dark:bg-slate-900 ${pdfUrl ? 'max-w-[400px] border-r border-slate-200 dark:border-slate-800' : ''}`}>
                <div className="space-y-6">
                    <header>
                        {isEditingTitle ? (
                           <textarea autoFocus className="w-full text-xl font-bold bg-slate-50 border-2 border-indigo-500 rounded p-2 focus:outline-none" value={titleInput} onChange={e => setTitleInput(e.target.value)} onBlur={() => { onUpdateMetadata(article.id, { title: titleInput }); setIsEditingTitle(false); }} />
                        ) : (
                           <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2 cursor-pointer hover:text-indigo-600" onClick={() => setIsEditingTitle(true)}>{article.metadata?.title || article.fileName}</h3>
                        )}
                        <div className="space-y-2">
                            <div className="text-sm flex gap-2">
                                <span className="font-semibold w-16 text-slate-500">Authors:</span>
                                {isEditingAuthors ? (
                                    <input autoFocus className="flex-1 border-b border-indigo-500 outline-none" value={authorsInput} onChange={e => setAuthorsInput(e.target.value)} onBlur={() => { onUpdateMetadata(article.id, { authors: authorsInput.split(',').map(s => s.trim()) }); setIsEditingAuthors(false); }} />
                                ) : (
                                    <span className="flex-1 cursor-pointer" onClick={() => setIsEditingAuthors(true)}>{article.metadata?.authors?.join(', ') || '-'}</span>
                                )}
                            </div>
                            <div className="text-sm flex gap-2">
                                <span className="font-semibold w-16 text-slate-500">Journal:</span>
                                {isEditingJournal ? (
                                    <input autoFocus className="flex-1 border-b border-indigo-500 outline-none" value={journalInput} onChange={e => setJournalInput(e.target.value)} onBlur={() => { onUpdateMetadata(article.id, { journal: journalInput }); setIsEditingJournal(false); }} />
                                ) : (
                                    <span className="flex-1 cursor-pointer" onClick={() => setIsEditingJournal(true)}>{article.metadata?.journal || '-'}</span>
                                )}
                            </div>
                        </div>
                    </header>
                    <div className="pt-4 border-t border-slate-100">
                        <h4 className="text-xs font-bold uppercase text-slate-500 mb-2">Categories</h4>
                        <div className="flex flex-wrap gap-1">
                            {article.metadata?.categories.map(cat => (
                                <span key={cat} className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getCategoryStyle(cat)}`}>{cat}</span>
                            ))}
                        </div>
                    </div>
                    <div className="pt-4 space-y-2">
                        <button onClick={handleLoadPdf} disabled={isLoadingPdf} className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow-md">{isLoadingPdf ? "Loading..." : "Read PDF"}</button>
                    </div>
                    <div className="pt-6 border-t border-slate-100">
                        <h4 className="text-xs font-bold uppercase text-slate-500 mb-4">Notes</h4>
                        {articleNotes.map(note => (
                            <div key={note.id} className="p-3 mb-2 rounded bg-slate-50 dark:bg-slate-800">
                                <h5 className="text-sm font-bold mb-1 cursor-pointer" onClick={() => onOpenNote(note)}>{note.title}</h5>
                                <div className="text-xs line-clamp-2 prose prose-xs dark:prose-invert"><ReactMarkdown>{note.content}</ReactMarkdown></div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            {pdfUrl && <div className="flex-1 bg-slate-200 h-full"><iframe src={pdfUrl} className="w-full h-full border-none" /></div>}
        </div>
    </div>
  );
};
