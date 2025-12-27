import React, { useState, useEffect } from 'react';
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
  onDeleteNote: (id: string) => void;
  onReplacePdf: (id: string, file: File) => Promise<void>;
}

export const ArticleDetail: React.FC<ArticleDetailProps> = ({ 
  article, 
  notes = [], 
  onClose, 
  onUpdateMetadata,
  onEditNote,
  onOpenNote,
  onDeleteNote,
  onReplacePdf
}) => {
  const [newKeyword, setNewKeyword] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState('');
  const [isEditingAuthors, setIsEditingAuthors] = useState(false);
  const [authorsInput, setAuthorsInput] = useState('');
  
  // New State for Journal/Volume
  const [isEditingJournal, setIsEditingJournal] = useState(false);
  const [journalInput, setJournalInput] = useState('');
  const [isEditingVolume, setIsEditingVolume] = useState(false);
  const [volumeInput, setVolumeInput] = useState('');
  
  // PDF Viewing State
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);

  // Update inputs when article changes
  useEffect(() => {
    if (article) {
        setTitleInput(article.metadata?.title || article.fileName);
        setAuthorsInput(article.metadata?.authors?.join(', ') || '');
        setJournalInput(article.metadata?.journal || 'Unknown Journal');
        setVolumeInput(article.metadata?.volume || '');
        
        setIsEditingTitle(false);
        setIsEditingAuthors(false);
        setIsEditingJournal(false);
        setIsEditingVolume(false);
        setPdfUrl(null); // Reset PDF view on article change
    }
  }, [article]);

  // Cleanup object URL
  useEffect(() => {
    return () => {
        if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [pdfUrl]);

  if (!article) return (
    <div className={`fixed inset-y-0 right-0 w-[450px] bg-white dark:bg-slate-900 shadow-2xl transform transition-transform duration-300 ease-in-out border-l border-slate-200 dark:border-slate-800 flex flex-col z-20 translate-x-full`}></div>
  );

  // Filter notes for this article
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

  const handleSaveTitle = () => {
      if (titleInput.trim()) {
          onUpdateMetadata(article.id, { title: titleInput.trim() });
          setIsEditingTitle(false);
      } else {
          // Revert if empty
          setTitleInput(article.metadata?.title || article.fileName);
          setIsEditingTitle(false);
      }
  };

  const handleSaveAuthors = () => {
      const newAuthors = authorsInput.split(',').map(s => s.trim()).filter(s => s.length > 0);
      onUpdateMetadata(article.id, { authors: newAuthors.length > 0 ? newAuthors : ["Unknown"] });
      setIsEditingAuthors(false);
  };

  const handleSaveJournal = () => {
      onUpdateMetadata(article.id, { journal: journalInput.trim() || "Unknown Journal" });
      setIsEditingJournal(false);
  };

  const handleSaveVolume = () => {
      onUpdateMetadata(article.id, { volume: volumeInput.trim() });
      setIsEditingVolume(false);
  };

  const handleDeleteNoteClick = (id: string) => {
      if(window.confirm("Are you sure you want to delete this note?")) {
          onDeleteNote(id);
      }
  };

  const handleTogglePdf = async () => {
      if (pdfUrl) {
          setPdfUrl(null);
      } else {
          setIsLoadingPdf(true);
          try {
            const blob = await getFileFromDB(article.id);
            if (blob) {
                setPdfUrl(URL.createObjectURL(blob));
            }
          } catch (e) {
              console.error("Failed to load PDF", e);
              alert("Failed to load PDF file.");
          } finally {
              setIsLoadingPdf(false);
          }
      }
  };

  const handleFileReplace = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if(window.confirm("This will replace the current PDF file with the selected one. Continue?")) {
        // If currently viewing, close it temporarily
        if (pdfUrl) setPdfUrl(null);
        
        await onReplacePdf(article.id, file);
        
        // Re-open
        try {
            const blob = await getFileFromDB(article.id);
            if (blob) {
                setPdfUrl(URL.createObjectURL(blob));
            }
        } catch(e) { console.error(e); }
      }
      
      // Reset input
      e.target.value = "";
  };

  const handleDownload = async () => {
      try {
          const blob = await getFileFromDB(article.id);
          if (blob) {
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = article.fileName;
              a.click();
              URL.revokeObjectURL(url);
          }
      } catch(e) {
          alert("Failed to download file");
      }
  };

  const handleExportCitation = () => {
      if (article.metadata?.bibtex) {
          const blob = new Blob([article.metadata.bibtex], { type: 'text/plain' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${article.fileName.replace(/\.pdf$/i, '')}.bib`;
          a.click();
          URL.revokeObjectURL(url);
      } else {
          alert("No BibTeX data available for this article.");
      }
  };

  const handleExportNotes = () => {
      if (articleNotes.length === 0) return;

      let content = `# Notes for ${article.metadata?.title || article.fileName}\n\n`;
      articleNotes.forEach(n => {
          content += `## ${n.title}\n${n.content}\n\n`;
      });
      
      const year = article.metadata?.year || 'Unknown';
      const safeTitle = (article.metadata?.title || article.fileName).replace(/[^a-z0-9]/gi, '_').substring(0, 50);
      const filename = `Notes_${safeTitle}_${year}.md`;

      const blob = new Blob([content], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
  };

  return (
    <div className={`fixed inset-y-0 right-0 ${pdfUrl ? 'w-[90vw] md:w-[85vw]' : 'w-[450px]'} bg-white dark:bg-slate-900 shadow-2xl transform transition-all duration-300 ease-in-out border-l border-slate-200 dark:border-slate-800 flex flex-col z-20 translate-x-0`}>
        {/* Header */}
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900 shrink-0">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Article Summary</h2>
            <div className="flex items-center gap-2">
                {pdfUrl && (
                    <>
                        <button 
                            onClick={handleDownload}
                            className="text-xs px-3 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded text-slate-700 dark:text-slate-200 transition-colors shadow-sm"
                            title="Download PDF"
                        >
                            Download
                        </button>
                        <label className="text-xs px-3 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded text-slate-700 dark:text-slate-200 transition-colors shadow-sm cursor-pointer">
                            Replace PDF
                            <input type="file" className="hidden" accept=".pdf" onChange={handleFileReplace} />
                        </label>
                        <div className="w-px h-4 bg-slate-300 dark:bg-slate-700 mx-1"></div>
                        <button 
                            onClick={() => setPdfUrl(null)}
                            className="text-xs px-3 py-1 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 rounded text-slate-700 dark:text-slate-200 transition-colors"
                        >
                            Close Reader
                        </button>
                    </>
                )}
                <button 
                onClick={onClose}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1"
                >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                </button>
            </div>
          </div>
          
          {/* Main Content Area */}
          <div className="flex-1 flex overflow-hidden">
            
            {/* Metadata Sidebar (Always visible) */}
            <div className={`flex-1 overflow-y-auto p-8 bg-white dark:bg-slate-900 ${pdfUrl ? 'max-w-[400px] border-r border-slate-200 dark:border-slate-800' : ''}`}>
                <div className="space-y-8">
                <header className="group">
                    {/* Title */}
                    {isEditingTitle ? (
                        <div className="mb-4">
                            <textarea
                                className="w-full text-2xl font-serif font-bold leading-tight text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 border-2 border-indigo-500 rounded p-2 focus:outline-none resize-none"
                                value={titleInput}
                                onChange={(e) => setTitleInput(e.target.value)}
                                onBlur={handleSaveTitle}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleSaveTitle();
                                    }
                                    if (e.key === 'Escape') {
                                        setIsEditingTitle(false);
                                        setTitleInput(article.metadata?.title || article.fileName);
                                    }
                                }}
                                autoFocus
                                rows={3}
                            />
                            <div className="text-xs text-slate-500 mt-1">Press Enter to save, Esc to cancel</div>
                        </div>
                    ) : (
                        <h3 
                            className="text-2xl font-serif font-bold leading-tight text-slate-900 dark:text-slate-100 mb-4 cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors relative"
                            onClick={() => setIsEditingTitle(true)}
                            title="Click to edit title"
                        >
                            {article.metadata?.title || article.fileName}
                            <button className="absolute -left-6 top-1.5 text-slate-300 hover:text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                </svg>
                            </button>
                        </h3>
                    )}

                    <div className="space-y-3">
                    <div className="flex gap-2 text-sm group/authors">
                        <span className="font-semibold text-slate-500 dark:text-slate-400 w-16 pt-1">Authors:</span>
                        {isEditingAuthors ? (
                            <div className="flex-1">
                                <textarea
                                    className="w-full text-sm text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-indigo-500 rounded p-1 focus:outline-none resize-none"
                                    value={authorsInput}
                                    onChange={(e) => setAuthorsInput(e.target.value)}
                                    onBlur={handleSaveAuthors}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            handleSaveAuthors();
                                        }
                                        if (e.key === 'Escape') {
                                            setIsEditingAuthors(false);
                                            setAuthorsInput(article.metadata?.authors?.join(', ') || '');
                                        }
                                    }}
                                    autoFocus
                                    rows={2}
                                />
                                <div className="text-[10px] text-slate-400 mt-0.5">Separate multiple authors with commas. Enter to save.</div>
                            </div>
                        ) : (
                            <span 
                                className="text-slate-700 dark:text-slate-300 flex-1 cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors relative pt-1"
                                onClick={() => setIsEditingAuthors(true)}
                                title="Click to edit authors"
                            >
                                {article.metadata?.authors?.join(', ') || 'Unknown'}
                                <button className="inline-block ml-2 text-slate-300 hover:text-indigo-500 opacity-0 group-hover/authors:opacity-100 transition-opacity">
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                    </svg>
                                </button>
                            </span>
                        )}
                    </div>
                    
                    {/* Journal Field */}
                    <div className="flex gap-2 text-sm group/journal">
                        <span className="font-semibold text-slate-500 dark:text-slate-400 w-16 pt-1">Journal:</span>
                        {isEditingJournal ? (
                             <div className="flex-1">
                                <input
                                    className="w-full text-sm text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-indigo-500 rounded p-1 focus:outline-none"
                                    value={journalInput}
                                    onChange={(e) => setJournalInput(e.target.value)}
                                    onBlur={handleSaveJournal}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            handleSaveJournal();
                                        }
                                        if (e.key === 'Escape') {
                                            setIsEditingJournal(false);
                                            setJournalInput(article.metadata?.journal || 'Unknown Journal');
                                        }
                                    }}
                                    autoFocus
                                />
                             </div>
                        ) : (
                            <span 
                                className="text-slate-700 dark:text-slate-300 flex-1 cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors relative pt-1"
                                onClick={() => setIsEditingJournal(true)}
                                title="Click to edit journal"
                            >
                                {article.metadata?.journal || 'Unknown Journal'}
                                <button className="inline-block ml-2 text-slate-300 hover:text-indigo-500 opacity-0 group-hover/journal:opacity-100 transition-opacity">
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                    </svg>
                                </button>
                            </span>
                        )}
                    </div>

                    {/* Volume Field */}
                    <div className="flex gap-2 text-sm group/volume">
                        <span className="font-semibold text-slate-500 dark:text-slate-400 w-16 pt-1">Volume:</span>
                        {isEditingVolume ? (
                             <div className="flex-1">
                                <input
                                    className="w-full text-sm text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-indigo-500 rounded p-1 focus:outline-none"
                                    value={volumeInput}
                                    onChange={(e) => setVolumeInput(e.target.value)}
                                    onBlur={handleSaveVolume}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            handleSaveVolume();
                                        }
                                        if (e.key === 'Escape') {
                                            setIsEditingVolume(false);
                                            setVolumeInput(article.metadata?.volume || '');
                                        }
                                    }}
                                    autoFocus
                                />
                             </div>
                        ) : (
                            <span 
                                className="text-slate-700 dark:text-slate-300 flex-1 cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors relative pt-1 min-h-[1.5rem]"
                                onClick={() => setIsEditingVolume(true)}
                                title="Click to edit volume"
                            >
                                {article.metadata?.volume || '-'}
                                <button className="inline-block ml-2 text-slate-300 hover:text-indigo-500 opacity-0 group-hover/volume:opacity-100 transition-opacity">
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                    </svg>
                                </button>
                            </span>
                        )}
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
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button 
                                                onClick={() => onEditNote(note)}
                                                className="p-1 text-amber-600 hover:text-amber-800 dark:text-amber-500 dark:hover:text-amber-300 bg-amber-100 dark:bg-amber-900/50 rounded"
                                                title="Edit Note"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                                </svg>
                                            </button>
                                            <button 
                                                onClick={() => handleDeleteNoteClick(note.id)}
                                                className="p-1 text-red-600 hover:text-red-800 dark:text-red-500 dark:hover:text-red-300 bg-red-100 dark:bg-red-900/30 rounded"
                                                title="Delete Note"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>
                                    <div className="prose prose-sm dark:prose-invert prose-amber max-w-none text-slate-800 dark:text-slate-200">
                                        <ReactMarkdown>{note.content.replace(/\n/g, '  \n')}</ReactMarkdown>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}
                
                <div className="pt-8 border-t border-slate-100 dark:border-slate-800 space-y-3">
                    <div className="flex gap-2">
                        <button
                            onClick={handleExportCitation}
                            className="flex-1 py-2 text-sm bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors border border-slate-200 dark:border-slate-700"
                        >
                            Export Citation
                        </button>
                        <button
                            onClick={handleExportNotes}
                            disabled={articleNotes.length === 0}
                            className={`flex-1 py-2 text-sm font-medium rounded transition-colors border ${
                                articleNotes.length === 0
                                ? 'bg-slate-50 dark:bg-slate-900 text-slate-400 dark:text-slate-600 border-slate-100 dark:border-slate-800 cursor-not-allowed'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700'
                            }`}
                        >
                            Export Notes
                        </button>
                    </div>

                    <button 
                    onClick={handleTogglePdf}
                    disabled={isLoadingPdf}
                    className="w-full py-3 bg-slate-900 dark:bg-indigo-600 text-white font-bold rounded-lg hover:bg-slate-800 dark:hover:bg-indigo-500 transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                    {isLoadingPdf ? (
                        <>
                            <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Loading...
                        </>
                    ) : (
                        <>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                {pdfUrl ? (
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                ) : (
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                )}
                            </svg>
                            {pdfUrl ? "Close PDF Reader" : "Read PDF"}
                        </>
                    )}
                    </button>
                    {!pdfUrl && (
                        <button
                            onClick={async () => {
                                const blob = await getFileFromDB(article.id);
                                if (blob) {
                                    const url = URL.createObjectURL(blob);
                                    window.open(url, '_blank');
                                }
                            }}
                            className="w-full mt-2 py-2 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                        >
                            Open in New Tab
                        </button>
                    )}
                </div>
                </div>
            </div>

            {/* PDF View (Right Side) */}
            {pdfUrl && (
                <div className="flex-1 bg-slate-200 dark:bg-slate-800 h-full relative flex flex-col">
                    <iframe 
                        src={pdfUrl} 
                        className="w-full h-full border-none" 
                        title="PDF Viewer"
                    />
                </div>
            )}
        </div>
    </div>
  );
};