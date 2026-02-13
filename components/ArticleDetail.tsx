
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
  
  const [editingField, setEditingField] = useState<string | null>(null);
  const [fieldValue, setFieldValue] = useState('');

  const [newCategory, setNewCategory] = useState('');
  const [newKeyword, setNewKeyword] = useState('');
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);
  const [showBibtex, setShowBibtex] = useState(false);
  const activeArticleIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (article) {
      if (article.id !== activeArticleIdRef.current) { 
        setPdfUrl(null); 
        activeArticleIdRef.current = article.id; 
        setShowBibtex(false);
      }
      if (!isEditingTitle) setTitleInput(article.metadata?.title || article.fileName);
    }
  }, [article, isEditingTitle]);

  useEffect(() => () => { if (pdfUrl) URL.revokeObjectURL(pdfUrl); }, [pdfUrl]);

  const articleNotes = useMemo(() => {
    return notes.filter(n => n.targetId === article?.id && n.type === 'article');
  }, [notes, article]);

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

  const handleAddCategory = () => {
    if (!newCategory.trim()) return;
    const current = article.metadata?.categories || [];
    if (!current.includes(newCategory.trim())) {
      onUpdateMetadata(article.id, { 
        categories: [...current.filter(c => c !== 'Uncategorized'), newCategory.trim()] 
      });
    }
    setNewCategory('');
  };

  const generateBibtex = () => {
    const m = article.metadata;
    if (!m) return "";
    const key = (m.authors[0]?.split(' ').pop() || 'Unknown') + m.year;
    return `@article{${key.toLowerCase()},
  title = {${m.title}},
  author = {${m.authors.join(' and ')}},
  journal = {${m.journal || ''}},
  year = {${m.year}},
  volume = {${m.volume || ''}},
  number = {${m.number || ''}},
  doi = {${m.doi || ''}},
  url = {${m.url || ''}}
}`;
  };

  const EditableField = ({ label, field, value, multiline = false }: any) => {
    const isEditing = editingField === field;
    return (
      <div className="text-sm flex gap-2 items-start group/field">
        <span className="font-semibold shrink-0 text-slate-500 mt-1 w-16">{label}:</span>
        {isEditing ? (
          multiline ? (
            <textarea 
              autoFocus 
              className="flex-1 bg-slate-100 dark:bg-slate-800 border-2 border-indigo-500 rounded p-1.5 text-sm text-slate-900 dark:text-white outline-none min-h-[80px]" 
              value={fieldValue} 
              onChange={e => setFieldValue(e.target.value)} 
              onBlur={() => {
                onUpdateMetadata(article.id, { [field]: fieldValue });
                setEditingField(null);
              }} 
            />
          ) : (
            <input 
              autoFocus 
              className="flex-1 bg-slate-100 dark:bg-slate-800 border-b-2 border-indigo-500 outline-none text-sm text-slate-900 dark:text-white px-1.5 py-1" 
              value={fieldValue} 
              onChange={e => setFieldValue(e.target.value)} 
              onBlur={() => {
                let finalVal: any = fieldValue;
                if (field === 'authors') finalVal = fieldValue.split(/[,;]/).map(s => s.trim()).filter(x => x);
                onUpdateMetadata(article.id, { [field]: finalVal });
                setEditingField(null);
              }} 
            />
          )
        ) : (
          <span 
            className="flex-1 cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 py-1 truncate" 
            onClick={() => {
              setEditingField(field);
              setFieldValue(field === 'authors' ? (article.metadata as any)[field].join(', ') : (article.metadata as any)[field] || '');
            }}
          >
              {(field === 'authors' ? article.metadata?.authors.join(', ') : (article.metadata as any)[field]) || <span className="text-slate-400 italic">Edit {label}</span>}
          </span>
        )}
      </div>
    );
  };

  return (
    <div className={`fixed inset-y-0 right-0 ${pdfUrl ? 'w-[94vw]' : 'w-[500px]'} bg-white dark:bg-slate-900 shadow-2xl transition-all duration-300 border-l border-slate-200 dark:border-slate-800 flex flex-col z-20`}>
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500">Document Analysis</h2>
            <div className="flex gap-2">
                {pdfUrl && <button onClick={() => setPdfUrl(null)} className="text-xs px-4 py-1.5 bg-indigo-600 text-white rounded font-bold shadow-md">Hide PDF</button>}
                <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
        </div>
        <div className="flex-1 flex overflow-hidden">
            <div className={`flex-1 overflow-y-auto p-8 ${pdfUrl ? 'max-w-[450px] border-r border-slate-200 dark:border-slate-800' : ''}`}>
                <div className="space-y-6">
                    <header>
                        {isEditingTitle ? (
                           <textarea autoFocus className="w-full text-xl font-bold bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border-2 border-indigo-500 rounded p-2 outline-none" value={titleInput} onChange={e => setTitleInput(e.target.value)} onBlur={() => { onUpdateMetadata(article.id, { title: titleInput }); setIsEditingTitle(false); }} />
                        ) : (
                           <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 cursor-pointer hover:text-indigo-600" onClick={() => setIsEditingTitle(true)}>{article.metadata?.title || article.fileName}</h3>
                        )}
                        
                        <div className="space-y-2 mt-6">
                            <EditableField label="Authors" field="authors" />
                            <EditableField label="Journal" field="journal" />
                            <div className="flex gap-4">
                                <div className="flex-1"><EditableField label="Year" field="year" /></div>
                                <div className="flex-1"><EditableField label="Volume" field="volume" /></div>
                                <div className="flex-1"><EditableField label="Issue" field="number" /></div>
                            </div>
                            <EditableField label="DOI" field="doi" />
                        </div>
                    </header>

                    <section className="pt-6 border-t border-slate-100 dark:border-slate-800">
                        <div className="flex items-center justify-between mb-3">
                            <h4 className="text-xs font-bold uppercase text-slate-500 tracking-widest">BiBTeX</h4>
                            <button onClick={() => setShowBibtex(!showBibtex)} className="text-[10px] text-indigo-500 font-bold hover:underline">{showBibtex ? 'Hide' : 'Show'}</button>
                        </div>
                        {showBibtex && (
                            <div className="relative group">
                                <pre className="p-3 bg-slate-50 dark:bg-slate-950 rounded border border-slate-200 dark:border-slate-800 text-[10px] font-mono overflow-x-auto text-slate-600 dark:text-slate-400">
                                    {generateBibtex()}
                                </pre>
                                <button 
                                    onClick={() => { navigator.clipboard.writeText(generateBibtex()); alert('Copied to clipboard'); }} 
                                    className="absolute top-2 right-2 p-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
                                </button>
                            </div>
                        )}
                    </section>

                    <section className="pt-6 border-t border-slate-100 dark:border-slate-800">
                        <h4 className="text-xs font-bold uppercase text-slate-500 mb-2 tracking-widest">Labels</h4>
                        <div className="flex flex-wrap gap-2 mb-3">
                            {article.metadata?.categories.map(cat => (
                                <span key={cat} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-bold border ${getCategoryStyle(cat)}`}>
                                    {cat}
                                    <button onClick={() => onUpdateMetadata(article.id, { categories: article.metadata!.categories.filter(c => c !== cat) })}><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg></button>
                                </span>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <input type="text" placeholder="Add Label..." className="flex-1 text-[10px] bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1.5 text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-indigo-500" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()} />
                            <button onClick={handleAddCategory} className="px-3 py-1 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded text-[10px] font-bold">Add</button>
                        </div>
                    </section>

                    <section className="pt-6 border-t border-slate-100 dark:border-slate-800">
                        <div className="flex items-center justify-between mb-4">
                            <h4 className="text-xs font-bold uppercase text-slate-500 tracking-widest">Notes</h4>
                            <button 
                                onClick={() => onEditNote({ id: '', title: 'New Article Note', content: '', type: 'article', targetId: article.id, createdAt: Date.now() })}
                                className="text-[10px] bg-indigo-600 text-white px-3 py-1 rounded font-bold"
                            >
                                + New Note
                            </button>
                        </div>
                        <div className="space-y-3">
                            {articleNotes.length === 0 ? (
                                <p className="text-[10px] text-slate-400 italic">No notes linked to this document.</p>
                            ) : (
                                articleNotes.map(note => (
                                    <div key={note.id} className="p-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 hover:border-indigo-200 dark:hover:border-indigo-900 transition-colors cursor-pointer" onClick={() => onOpenNote(note)}>
                                        <div className="flex justify-between items-start mb-1">
                                            <h5 className="text-[11px] font-bold text-slate-800 dark:text-slate-200 truncate">{note.title}</h5>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); onDeleteNote(note.id); }}
                                                className="text-slate-400 hover:text-red-500"
                                            >
                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7" strokeWidth={2} /></svg>
                                            </button>
                                        </div>
                                        <p className="text-[10px] text-slate-500 line-clamp-2">{note.content}</p>
                                    </div>
                                ))
                            )}
                        </div>
                    </section>

                    <div className="pt-6 pb-20">
                        <button onClick={handleLoadPdf} disabled={isLoadingPdf} className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95">
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
