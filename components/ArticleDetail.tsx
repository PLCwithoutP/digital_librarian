
import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Article, ArticleMetadata, Note } from '../types';
import { getFileFromDB } from '../db';

interface ArticleDetailProps {
  article: Article | null | undefined;
  notes?: Note[];
  onClose: () => void;
  onUpdateMetadata: (id: string, updates: Partial<ArticleMetadata>) => void;
  onEditNote: (note: Note) => void;
  onOpenNote: (note: Note) => void;
}

export const ArticleDetail: React.FC<ArticleDetailProps> = ({ 
  article, 
  notes = [], 
  onClose, 
  onUpdateMetadata,
  onEditNote,
  onOpenNote
}) => {
  const [newKeyword, setNewKeyword] = useState('');
  const [newCategory, setNewCategory] = useState('');

  if (!article) return (
    <div className={`fixed inset-y-0 right-0 w-[450px] bg-white dark:bg-slate-900 shadow-2xl transform transition-transform duration-300 ease-in-out border-l border-slate-200 dark:border-slate-800 flex flex-col z-20 translate-x-full`}></div>
  );

  const articleNotes = notes.filter(n => n.type === 'article' && n.targetId === article.id);

  const handleAddKeyword = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && newKeyword.trim()) {
      const currentKeywords = article.metadata?.keywords || [];
      if (!currentKeywords.includes(newKeyword.trim())) {
        onUpdateMetadata(article.id, { 
          keywords: [...currentKeywords, newKeyword.trim()] 
        });
      }
      setNewKeyword('');
    }
  };

  const handleRemoveKeyword = (keywordToRemove: string) => {
    const currentKeywords = article.metadata?.keywords || [];
    onUpdateMetadata(article.id, { 
      keywords: currentKeywords.filter(k => k !== keywordToRemove) 
    });
  };

  const handleAddCategory = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && newCategory.trim()) {
        const currentCategories = article.metadata?.categories || [];
        if (!currentCategories.includes(newCategory.trim())) {
            onUpdateMetadata(article.id, {
                categories: [...currentCategories, newCategory.trim()]
            });
        }
        setNewCategory('');
    }
  };

  const handleRemoveCategory = (catToRemove: string) => {
      const currentCategories = article.metadata?.categories || [];
      onUpdateMetadata(article.id, {
          categories: currentCategories.filter(c => c !== catToRemove)
      });
  };

  return (
    <div className={`fixed inset-y-0 right-0 w-[450px] bg-white dark:bg-slate-900 shadow-2xl transform transition-transform duration-300 ease-in-out border-l border-slate-200 dark:border-slate-800 flex flex-col z-20 translate-x-0`}>
        <>
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Article Summary</h2>
            <button 
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-8 bg-white dark:bg-slate-900">
            <div className="space-y-8">
              <header>
                <h3 className="text-2xl font-serif font-bold leading-tight text-slate-900 dark:text-slate-100 mb-4">
                  {article.metadata?.title || article.fileName}
                </h3>
                <div className="space-y-2">
                  <div className="flex gap-2 text-sm">
                    <span className="font-semibold text-slate-500 dark:text-slate-400 w-16">Authors:</span>
                    <span className="text-slate-700 dark:text-slate-300 flex-1">{article.metadata?.authors?.join(', ') || 'Unknown'}</span>
                  </div>
                  <div className="flex gap-2 text-sm">
                    <span className="font-semibold text-slate-500 dark:text-slate-400 w-16">Year:</span>
                    <span className="text-slate-700 dark:text-slate-300">{article.metadata?.year || 'Unknown'}</span>
                  </div>
                </div>
              </header>

              <section>
                <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">Categories (Labels)</h4>
                <div className="flex flex-wrap gap-2 mb-2">
                  {article.metadata?.categories?.length ? article.metadata.categories.map(cat => (
                    <span key={cat} className="group px-2.5 py-1 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-xs font-semibold rounded-md border border-indigo-100 dark:border-indigo-800 flex items-center gap-1">
                      {cat}
                      <button 
                        onClick={() => handleRemoveCategory(cat)}
                        className="opacity-0 group-hover:opacity-100 hover:text-indigo-900 dark:hover:text-white transition-opacity"
                      >
                         ×
                      </button>
                    </span>
                  )) : (
                    <span className="text-sm text-slate-400 italic">No categories</span>
                  )}
                </div>
                <input 
                    type="text" 
                    className="text-xs w-full px-2 py-1 border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-200 focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-400"
                    placeholder="+ Add Label (Press Enter)"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    onKeyDown={handleAddCategory}
                />
              </section>

              <section>
                <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">Keywords</h4>
                <div className="flex flex-wrap gap-2 mb-2">
                  {article.metadata?.keywords?.map(kw => (
                    <span key={kw} className="group px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-medium rounded-md border border-slate-200 dark:border-slate-700 flex items-center gap-1">
                      {kw}
                      <button 
                        onClick={() => handleRemoveKeyword(kw)}
                        className="opacity-0 group-hover:opacity-100 hover:text-slate-900 dark:hover:text-white transition-opacity"
                      >
                         ×
                      </button>
                    </span>
                  ))}
                </div>
                <input 
                    type="text" 
                    className="text-xs w-full px-2 py-1 border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-200 focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-400"
                    placeholder="+ Add Keyword (Press Enter)"
                    value={newKeyword}
                    onChange={(e) => setNewKeyword(e.target.value)}
                    onKeyDown={handleAddKeyword}
                />
              </section>

              {articleNotes.length > 0 && (
                <section>
                    <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Attached Notes
                    </h4>
                    <div className="space-y-4">
                        {articleNotes.map(note => (
                            <div key={note.id} className="bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 rounded-lg p-4 group">
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex flex-col cursor-pointer hover:underline" onClick={() => onOpenNote(note)}>
                                        <span className="text-xs font-bold text-amber-800 dark:text-amber-500 uppercase">{note.title}</span>
                                        <span className="text-[10px] text-amber-600 dark:text-amber-600">{new Date(note.createdAt).toLocaleDateString()}</span>
                                    </div>
                                    <button 
                                        onClick={() => onEditNote(note)}
                                        className="opacity-0 group-hover:opacity-100 p-1 text-amber-600 hover:text-amber-800 dark:text-amber-500 dark:hover:text-amber-300 transition-opacity bg-amber-100 dark:bg-amber-900/50 rounded"
                                        title="Edit Note"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                        </svg>
                                    </button>
                                </div>
                                <div className="prose prose-sm dark:prose-invert prose-amber max-w-none text-slate-800 dark:text-slate-200">
                                    <ReactMarkdown>{note.content.replace(/\n/g, '  \n')}</ReactMarkdown>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
              )}
              
              <div className="pt-8 border-t border-slate-100 dark:border-slate-800">
                <button 
                  onClick={async () => {
                    const blob = await getFileFromDB(article.id);
                    if (blob) {
                      const url = URL.createObjectURL(blob);
                      window.open(url, '_blank');
                    }
                  }}
                  className="w-full py-3 bg-slate-900 dark:bg-indigo-600 text-white font-bold rounded-lg hover:bg-slate-800 dark:hover:bg-indigo-500 transition-all shadow-md flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  Open PDF File
                </button>
              </div>
            </div>
          </div>
        </>
    </div>
  );
};
