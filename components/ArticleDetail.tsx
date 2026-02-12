
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
  const [isEditingAbstract, setIsEditingAbstract] = useState(false);
  const [abstractInput, setAbstractInput] = useState('');
  
  const [newCategory, setNewCategory] = useState('');
  const [newKeyword, setNewKeyword] = useState('');
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);
  const activeArticleIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (article) {
        if (article.id !== activeArticleIdRef.current) { setPdfUrl(null); activeArticleIdRef.current = article.id; }
        if (!isEditingTitle) setTitleInput(article.metadata?.title || article.fileName);
        if (!isEditingAuthors) setAuthorsInput(article.metadata?.authors?.join(', ') || '');
        if (!isEditingJournal) setJournalInput(article.metadata?.journal || '');
        if (!isEditingYear) setYearInput(article.metadata?.year || '');
        if (!isEditingAbstract) setAbstractInput(article.metadata?.abstract || '');
    }
  }, [article, isEditingTitle, isEditingAuthors, isEditingJournal, isEditingYear, isEditingAbstract]);

  useEffect(() => () => { if (pdfUrl) URL.revokeObjectURL(pdfUrl); }, [pdfUrl]);

  if (!article) return null;

  const handleLoadPdf = () => {
    setIsLoadingPdf(true);
    const file = getPDF(article.id);
    if (file) {
        if (pdfUrl) URL.revokeObjectURL(pdfUrl);
        setPdfUrl(URL.createObjectURL(new Blob([file], { type: 'application/pdf' })));
    } else {
        alert("Local file link is missing. Click 'Sync' on the sidebar folder and re-select the directory to restore access.");
    }
    setIsLoadingPdf(false);
  };

  const handleAddKeyword = () => {
    if (!newKeyword.trim()) return;
    const current = article.metadata?.keywords || [];
    if (!current.includes(newKeyword.trim())) onUpdateMetadata(article.id, { keywords: [...current, newKeyword.trim()] });
    setNewKeyword('');
  };

  const handleRemoveKeyword = (kw: string) => {
    onUpdateMetadata(article.id, { keywords: (article.metadata?.keywords || []).filter(k => k !== kw) });
  };

  const EditableField = ({ label, value, isEditing, setIsEditing, inputValue, setInputValue, onSave, multiline = false }: any) => (
    <div className="text-sm flex gap-2 items-start group/field">
      <span className="font-semibold shrink-0 text-slate-500 mt-1 w-16">{label}:</span>
      {isEditing ? (
        multiline ? (
          <textarea autoFocus className="flex-1 bg-slate-100 dark:bg-slate-800 border-2 border-indigo-500 rounded p-1.5 text-sm text-slate-900 dark:text-white outline-none min-h-[140px]" value={inputValue} onChange={e => setInputValue(e.target.value)} onBlur={() => { onSave(); setIsEditing(false); }} />
        ) : (
          <input autoFocus className="flex-1 bg-slate-100 dark:bg-slate-800 border-b-2 border-indigo-500 outline-none text-sm text-slate-900 dark:text-white px-1.5 py-1" value={inputValue} onChange={e => setInputValue(e.target.value)} onBlur={() => { onSave(); setIsEditing(false); }} />
        )
      ) : (
        <span className="flex-1 cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 py-1 truncate" onClick={() => setIsEditing(true)}>
            {value || <span className="text-slate-400 italic">Edit Field</span>}
        </span>
      )}
    </div>
  );

  return (
    <div className={`fixed inset-y-0 right-0 ${pdfUrl ? 'w-[94vw]' : 'w-[450px]'} bg-white dark:bg-slate-900 shadow-2xl transition-all duration-300 border-l border-slate-200 dark:border-slate-800 flex flex-col z-20`}>
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500">Document Details</h2>
            <div className="flex gap-2">
                {pdfUrl && <button onClick={() => setPdfUrl(null)} className="text-xs px-4 py-1.5 bg-indigo-600 text-white rounded font-bold shadow-md">Close PDF</button>}
                <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
        </div>
        <div className="flex-1 flex overflow-hidden">
            <div className={`flex-1 overflow-y-auto p-8 ${pdfUrl ? 'max-w-[400px] border-r border-slate-200 dark:border-slate-800' : ''}`}>
                <div className="space-y-6">
                    <header>
                        {isEditingTitle ? (
                           <textarea autoFocus className="w-full text-xl font-bold bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border-2 border-indigo-500 rounded p-2 outline-none" value={titleInput} onChange={e => setTitleInput(e.target.value)} onBlur={() => { onUpdateMetadata(article.id, { title: titleInput }); setIsEditingTitle(false); }} />
                        ) : (
                           <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 cursor-pointer hover:text-indigo-600" onClick={() => setIsEditingTitle(true)}>{article.metadata?.title || article.fileName}</h3>
                        )}
                        <div className="space-y-3 mt-6">
                            <EditableField label="Authors" value={article.metadata?.authors?.join(', ')} isEditing={isEditingAuthors} setIsEditing={setIsEditingAuthors} inputValue={authorsInput} setInputValue={setAuthorsInput} onSave={() => onUpdateMetadata(article.id, { authors: authorsInput.split(/[,;]/).map(s => s.trim()).filter(x => x) })} />
                            <EditableField label="Journal" value={article.metadata?.journal} isEditing={isEditingJournal} setIsEditing={setIsEditingJournal} inputValue={journalInput} setInputValue={setJournalInput} onSave={() => onUpdateMetadata(article.id, { journal: journalInput })} />
                            <EditableField label="Year" value={article.metadata?.year} isEditing={isEditingYear} setIsEditing={setIsEditingYear} inputValue={yearInput} setInputValue={setYearInput} onSave={() => onUpdateMetadata(article.id, { year: yearInput })} />
                        </div>
                    </header>

                    <section className="pt-6 border-t border-slate-100 dark:border-slate-800">
                        <h4 className="text-xs font-bold uppercase text-slate-500 mb-3 tracking-widest">Keywords</h4>
                        <div className="flex flex-wrap gap-2 mb-3">
                            {article.metadata?.keywords.map(kw => (
                                <span key={kw} className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-800">
                                    {kw}
                                    <button onClick={() => handleRemoveKeyword(kw)} className="hover:text-red-500 transition-colors"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg></button>
                                </span>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <input type="text" placeholder="Add Keyword..." className="flex-1 text-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1.5 text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-indigo-500" value={newKeyword} onChange={(e) => setNewKeyword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddKeyword()} />
                            <button onClick={handleAddKeyword} className="px-3 py-1 bg-indigo-600 text-white rounded text-xs font-bold shadow-sm">Add</button>
                        </div>
                    </section>

                    <section className="pt-6 border-t border-slate-100 dark:border-slate-800">
                        <h4 className="text-xs font-bold uppercase text-slate-500 mb-2 tracking-widest">Labels</h4>
                        <div className="flex flex-wrap gap-2">
                            {article.metadata?.categories.map(cat => (
                                <span key={cat} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium border ${getCategoryStyle(cat)}`}>
                                    {cat}
                                    <button onClick={() => onUpdateMetadata(article.id, { categories: article.metadata!.categories.filter(c => c !== cat) })}><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg></button>
                                </span>
                            ))}
                        </div>
                    </section>

                    <div className="pt-6 pb-12">
                        <button onClick={handleLoadPdf} disabled={isLoadingPdf} className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-2">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                            {isLoadingPdf ? "Loading..." : "Read PDF"}
                        </button>
                    </div>
                </div>
            </div>
            {pdfUrl && (
              <div className="flex-1 bg-slate-200 h-full relative border-l border-slate-300 dark:border-slate-700">
                <object data={pdfUrl} type="application/pdf" className="w-full h-full">
                    <div className="flex flex-col items-center justify-center h-full bg-slate-100 dark:bg-slate-800 text-slate-500 p-12 text-center">
                        <p className="font-bold mb-2">Browser Preview Blocked</p>
                        <a href={pdfUrl} target="_blank" rel="noreferrer" className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold">Open External Tab</a>
                    </div>
                </object>
              </div>
            )}
        </div>
    </div>
  );
};
