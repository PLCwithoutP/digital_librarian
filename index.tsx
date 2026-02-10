
import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { Article, Source, ArticleMetadata, Note, NoteType } from './types';
import { getAllData, saveArticleToDB, saveFileToDB, saveSourceToDB, saveNoteToDB, getFileFromDB, deleteSourceFromDB, deleteArticleFromDB, deleteFileFromDB, deleteNoteFromDB, clearDatabase, restoreSession } from './db';
import { Sidebar } from './components/Sidebar';
import { ArticleList } from './components/ArticleList';
import { ArticleDetail } from './components/ArticleDetail';
import { SettingsModal, ThemeOption } from './components/SettingsModal';
import { NotebookModal } from './components/NotebookModal';
import { NoteViewerModal } from './components/NoteViewerModal';
import { NotebookEditor } from './components/NotebookEditor';
import { AddSourceModal } from './components/AddSourceModal';
import { GenerateModal } from './components/GenerateModal';

const LibrarianApp = () => {
  const [sources, setSources] = useState<Source[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSourceId, setActiveSourceId] = useState<string | null>(null);
  const [isGrouped, setIsGrouped] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [checkedArticleIds, setCheckedArticleIds] = useState<Set<string>>(new Set());
  
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [theme, setTheme] = useState<ThemeOption>('default');
  const [isNotebookSetupOpen, setIsNotebookSetupOpen] = useState(false);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [activeEditorNote, setActiveEditorNote] = useState<Partial<Note> | null>(null);
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [isAddSourceModalOpen, setIsAddSourceModalOpen] = useState(false);
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem('librarian_theme') as ThemeOption | null;
    if (savedTheme) setTheme(savedTheme);
  }, []);

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('dark');
    if (theme === 'dark') {
      root.classList.add('dark');
    } else if (theme === 'default' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      root.classList.add('dark');
    }
    if (theme !== 'default') localStorage.setItem('librarian_theme', theme);
    else localStorage.removeItem('librarian_theme');
  }, [theme]);

  // Fix: Load library data from DB on initialization
  useEffect(() => {
    const initSession = async () => {
      setIsLoading(true);
      setLoadingMessage('Loading library...');
      try {
        const data = await getAllData();
        setSources(data.sources || []);
        setArticles(data.articles || []);
        setNotes(data.notes || []);
      } catch (err) {
        console.error("Failed to initialize session", err);
      } finally {
        setIsLoading(false);
      }
    };
    initSession();
  }, []);

  const processMetadataFiles = async (files: File[]): Promise<Map<string, any>> => {
      const jsonFiles = files.filter(f => f.name.toLowerCase().endsWith('.json'));
      const pdfMetadataMap = new Map<string, any>();

      for (const jsonFile of jsonFiles) {
          try {
              const text = await jsonFile.text();
              const data = JSON.parse(text);
              
              // Support specific 'pdfs' array format
              if (data.pdfs && Array.isArray(data.pdfs)) {
                  data.pdfs.forEach((pdf: any) => {
                      if (pdf.file_name) pdfMetadataMap.set(pdf.file_name, pdf);
                  });
              }
              // Support BibTeX JSON format
              if (data.entries && Array.isArray(data.entries)) {
                  data.entries.forEach((entry: any) => {
                      if (entry.file_name) {
                          const existing = pdfMetadataMap.get(entry.file_name) || {};
                          pdfMetadataMap.set(entry.file_name, { ...existing, ...entry });
                      }
                  });
              }
          } catch (err) {
              console.warn(`Failed to parse metadata file ${jsonFile.name}:`, err);
          }
      }
      return pdfMetadataMap;
  };

  const createMetadata = (file: File, meta: any | undefined): ArticleMetadata => {
      if (meta) {
          return {
              title: meta.title || file.name.replace(/\.pdf$/i, ''),
              authors: Array.isArray(meta.authors) ? meta.authors : meta.pdf_meta?.['/Author'] ? [meta.pdf_meta['/Author']] : ["Unknown"],
              journal: meta.journal || "",
              volume: meta.volume || "",
              number: meta.number || null,
              year: meta.year ? String(meta.year) : "Unknown",
              abstract: meta.abstract || "",
              keywords: Array.isArray(meta.keywords) ? meta.keywords : [],
              categories: Array.isArray(meta.categories) ? meta.categories : ["Uncategorized"],
              bibtex: meta.bibtex || "" 
          };
      } else {
          return {
              title: file.name.replace(/\.pdf$/i, ''),
              authors: ["Unknown"],
              journal: "",
              volume: "",
              number: null,
              year: "Unknown",
              categories: ["Uncategorized"],
              keywords: [],
              abstract: "",
              bibtex: ""
          };
      }
  };

  const handleExportMetadata = () => {
    if (articles.length === 0) {
      alert("No articles to export.");
      return;
    }

    const exportData = {
      root_path: "Librarian Library",
      generated_at: new Date().toISOString().split('.')[0],
      pdf_count: articles.length,
      pdfs: articles.map(art => ({
        file_path: art.filePath || art.fileName,
        file_name: art.fileName,
        title: art.metadata?.title || art.fileName,
        authors: art.metadata?.authors || [],
        year: parseInt(String(art.metadata?.year)) || null,
        journal: art.metadata?.journal || "",
        volume: art.metadata?.volume || null,
        number: art.metadata?.number || null
      }))
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'parsed_pdfs.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleAddSource = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setIsLoading(true);
    setLoadingMessage('Processing folder structure...');
    try {
        const fileList: File[] = Array.from(files);
        const pathSourceIdMap = new Map<string, string>();
        const newSources: Source[] = [];
        
        const getOrCreateSource = (fullPath: string, folderName: string, parentPath: string | null): string => {
            if (pathSourceIdMap.has(fullPath)) return pathSourceIdMap.get(fullPath)!;
            const id = crypto.randomUUID();
            const parentId = parentPath ? pathSourceIdMap.get(parentPath) : undefined;
            const newSource: Source = { id, name: folderName, parentId };
            newSources.push(newSource);
            pathSourceIdMap.set(fullPath, id);
            return id;
        };

        const pdfMetadataMap = await processMetadataFiles(fileList);
        const newArticles: Article[] = [];

        for (const file of fileList) {
            if (!file.name.toLowerCase().endsWith('.pdf')) continue;
            const relativePath = (file as any).webkitRelativePath || file.name;
            const pathParts = relativePath.split('/');
            let sourceId: string;
            
            if (pathParts.length > 1) {
                const folderParts = pathParts.slice(0, -1);
                let currentPath = "";
                let prevSourcePath = null;
                for (const folderName of folderParts) {
                    const parentPath = currentPath;
                    currentPath = currentPath ? `${currentPath}/${folderName}` : folderName;
                    getOrCreateSource(currentPath, folderName, parentPath || null);
                }
                sourceId = pathSourceIdMap.get(currentPath)!;
            } else {
                const rootSourceName = "Imported Files";
                let existingRoot = sources.find(s => s.name === rootSourceName);
                if(existingRoot) sourceId = existingRoot.id;
                else {
                    sourceId = crypto.randomUUID();
                    newSources.push({ id: sourceId, name: rootSourceName });
                }
            }

            const meta = pdfMetadataMap.get(file.name);
            const articleMetadata = createMetadata(file, meta);
            const articleId = crypto.randomUUID();
            
            newArticles.push({
                id: articleId,
                sourceId,
                fileName: file.name,
                filePath: relativePath,
                fileSize: file.size,
                addedAt: Date.now(),
                status: 'completed',
                metadata: articleMetadata
            });
            await saveFileToDB(articleId, file);
        }

        for (const a of newArticles) await saveArticleToDB(a);
        for (const s of newSources) await saveSourceToDB(s);

        setSources(prev => [...prev, ...newSources]);
        setArticles(prev => [...prev, ...newArticles]);
    } catch (err) {
        console.error("Import failed", err);
        alert("Failed to import folder structure.");
    } finally {
        setIsLoading(false);
        if (e.target) e.target.value = "";
    }
  };

  const handleAddPDF = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;
      setIsLoading(true);
      setLoadingMessage('Importing PDF files...');
      try {
        let uploadSource = sources.find(s => s.name === "Uploaded Files");
        let sourceId = uploadSource?.id;
        if (!uploadSource) {
            sourceId = crypto.randomUUID();
            uploadSource = { id: sourceId, name: "Uploaded Files" };
            setSources(prev => [...prev, uploadSource!]);
            await saveSourceToDB(uploadSource);
        }

        const fileList: File[] = Array.from(files);
        const pdfMetadataMap = await processMetadataFiles(fileList);
        const newArticles: Article[] = [];
        for (const file of fileList) {
            if (!file.name.toLowerCase().endsWith('.pdf')) continue;
            const meta = pdfMetadataMap.get(file.name);
            const articleMetadata = createMetadata(file, meta);
            const articleId = crypto.randomUUID();
            const article: Article = {
                id: articleId,
                sourceId: sourceId!,
                fileName: file.name,
                fileSize: file.size,
                addedAt: Date.now(),
                status: 'completed',
                metadata: articleMetadata
            };
            newArticles.push(article);
            await saveFileToDB(articleId, file);
            await saveArticleToDB(article);
        }
        setArticles(prev => [...prev, ...newArticles]);
      } catch(err) {
          console.error(err);
          alert("Error importing files.");
      } finally {
        setIsLoading(false);
        if (e.target) e.target.value = "";
      }
  };

  const handleUpdateArticle = async (id: string, updates: Partial<ArticleMetadata>) => {
    setArticles(prev => {
        const idx = prev.findIndex(a => a.id === id);
        if (idx === -1) return prev;
        const newArr = [...prev];
        newArr[idx] = { ...newArr[idx], metadata: { ...newArr[idx].metadata!, ...updates } };
        saveArticleToDB(newArr[idx]);
        return newArr;
    });
  };

  const handleSort = (key: string) => {
    setSortConfig(current => {
      if (current?.key === key) return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
      return { key, direction: 'asc' };
    });
  };

  // Fix: Added missing handleDeleteSource
  const handleDeleteSource = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this source? Articles will be preserved.")) return;
    try {
      await deleteSourceFromDB(id);
      setSources(prev => prev.filter(s => s.id !== id));
      if (activeSourceId === id) setActiveSourceId(null);
    } catch (err) {
      console.error("Failed to delete source", err);
    }
  };

  // Fix: Added missing handleSaveSession
  const handleSaveSession = () => {
    const sessionData = {
      sources,
      articles,
      notes,
      exportedAt: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(sessionData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `librarian_session_${new Date().getTime()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Fix: Added missing handleImportSession
  const handleImportSession = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      setIsLoading(true);
      setLoadingMessage('Importing session...');
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (data.sources && data.articles) {
          await restoreSession(data.sources, data.articles, data.notes || []);
          setSources(data.sources);
          setArticles(data.articles);
          setNotes(data.notes || []);
        }
      } catch (err) {
        console.error("Import failed", err);
        alert("Failed to import session file.");
      } finally {
        setIsLoading(false);
      }
    };
    input.click();
  };

  // Fix: Added missing handleDeleteSelected
  const handleDeleteSelected = async () => {
    if (checkedArticleIds.size === 0) return;
    if (!window.confirm(`Are you sure you want to delete ${checkedArticleIds.size} articles?`)) return;
    setIsLoading(true);
    setLoadingMessage('Deleting articles...');
    try {
      for (const id of checkedArticleIds) {
        await deleteArticleFromDB(id);
        await deleteFileFromDB(id);
      }
      setArticles(prev => prev.filter(a => !checkedArticleIds.has(a.id)));
      setCheckedArticleIds(new Set());
      if (selectedArticleId && checkedArticleIds.has(selectedArticleId)) {
        setSelectedArticleId(null);
      }
    } catch (err) {
      console.error("Delete failed", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Fix: Added missing handleReplacePdf
  const handleReplacePdf = async (id: string, file: File) => {
    setIsLoading(true);
    setLoadingMessage('Replacing PDF...');
    try {
      await saveFileToDB(id, file);
      setArticles(prev => prev.map(a => a.id === id ? { ...a, fileName: file.name, fileSize: file.size } : a));
    } catch (err) {
      console.error("Replace failed", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Fix: Added missing handleGenerateConfirm
  const handleGenerateConfirm = (options: {
    references: boolean;
    notes: boolean;
    notesOptions: {
        general: boolean;
        category: boolean;
        article: boolean;
    };
    format?: string;
  }) => {
    const selectedArticles = articles.filter(a => checkedArticleIds.has(a.id));
    console.log("Generating output for", selectedArticles.length, "articles with options", options);
    alert(`Generation requested for ${selectedArticles.length} articles with options: ${JSON.stringify(options)}. (Gemini API would be called here)`);
  };

  const filteredArticles = useMemo(() => {
    let list = articles;
    if (activeSourceId) {
        const descendants = new Set<string>([activeSourceId as string]);
        const addDescendants = (parentId: string) => {
            sources.filter(s => s.parentId === parentId).forEach(c => {
                descendants.add(c.id);
                addDescendants(c.id);
            });
        };
        addDescendants(activeSourceId);
        list = list.filter(a => descendants.has(a.sourceId));
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(a => (
        a.fileName.toLowerCase().includes(q) ||
        a.metadata?.title.toLowerCase().includes(q) ||
        a.metadata?.authors.some(auth => auth.toLowerCase().includes(q)) ||
        a.metadata?.journal?.toLowerCase().includes(q) ||
        a.metadata?.year.includes(q)
      ));
    }
    if (sortConfig) {
      list.sort((a, b) => {
        let valA: any = '', valB: any = '';
        switch(sortConfig.key) {
          case 'publication': valA = (a.metadata?.title || a.fileName).toLowerCase(); valB = (b.metadata?.title || b.fileName).toLowerCase(); break;
          case 'authors': valA = (a.metadata?.authors?.[0] || '').toLowerCase(); valB = (b.metadata?.authors?.[0] || '').toLowerCase(); break;
          case 'journal': valA = (a.metadata?.journal || '').toLowerCase(); valB = (b.metadata?.journal || '').toLowerCase(); break;
          case 'year': valA = parseInt(String(a.metadata?.year || '0'), 10); valB = parseInt(String(b.metadata?.year || '0'), 10); break;
        }
        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    } else list.sort((a, b) => b.addedAt - a.addedAt);
    return [...list];
  }, [articles, activeSourceId, searchQuery, sortConfig, sources]);

  const allCategories = useMemo(() => {
      const cats = new Set<string>();
      articles.forEach(a => a.metadata?.categories.forEach(c => cats.add(c)));
      return Array.from(cats).sort();
  }, [articles]);

  const selectedArticle = articles.find(a => a.id === selectedArticleId);

  return (
    <div className="flex h-screen w-screen bg-slate-50 dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100 overflow-hidden transition-colors duration-200">
      {isLoading && (
        <div className="fixed inset-0 z-[100] bg-white/80 dark:bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center">
            <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
            <p className="text-lg font-semibold text-slate-700 dark:text-slate-300 animate-pulse">{loadingMessage}</p>
        </div>
      )}

      <Sidebar 
        sources={sources}
        articles={articles}
        notes={notes}
        activeSourceId={activeSourceId}
        onSetActiveSource={setActiveSourceId}
        onOpenAddModal={() => setIsAddSourceModalOpen(true)}
        onOpenGenerateModal={() => setIsGenerateModalOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenNote={(note) => setSelectedNote(note)}
        onDeleteSource={handleDeleteSource}
        onExportMetadata={handleExportMetadata}
        isGenerateDisabled={checkedArticleIds.size === 0}
      />

      <ArticleList 
        articles={filteredArticles}
        selectedArticleId={selectedArticleId}
        onSelectArticle={setSelectedArticleId}
        checkedArticleIds={checkedArticleIds}
        onToggleArticle={(id) => setCheckedArticleIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        })}
        onToggleAll={(ids) => setCheckedArticleIds(new Set(ids))}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSaveSession={handleSaveSession}
        onImportSession={handleImportSession}
        onDeleteSelected={handleDeleteSelected}
        isGrouped={isGrouped}
        onToggleGroup={() => setIsGrouped(!isGrouped)}
        sortConfig={sortConfig}
        onSort={handleSort}
      />

      <ArticleDetail 
        article={selectedArticle}
        notes={notes}
        onClose={() => setSelectedArticleId(null)}
        onUpdateMetadata={handleUpdateArticle}
        onEditNote={(note) => { setSelectedNote(null); setIsEditingNote(true); setActiveEditorNote(note); }}
        onOpenNote={setSelectedNote}
        onDeleteNote={(id) => { deleteNoteFromDB(id); setNotes(n => n.filter(x => x.id !== id)); if(selectedNote?.id === id) setSelectedNote(null); }}
        onReplacePdf={handleReplacePdf}
      />

      <button onClick={() => checkedArticleIds.size === 1 ? (() => { const aid = Array.from(checkedArticleIds)[0]; const art = articles.find(a => a.id === aid); setSelectedNote(null); setIsEditingNote(false); setActiveEditorNote({ type: 'article', targetId: aid, content: '', title: `Notes on ${art?.metadata?.title || art?.fileName}` }); })() : setIsNotebookSetupOpen(true)} className="fixed bottom-6 right-6 z-[40] p-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-lg transition-transform hover:scale-110 active:scale-95 flex items-center justify-center" title="Open Notebook">
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
      </button>

      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} currentTheme={theme} onThemeChange={setTheme} />
      <NotebookModal isOpen={isNotebookSetupOpen} onClose={() => setIsNotebookSetupOpen(false)} articles={articles} categories={allCategories} onConfirm={(type, tid) => { setIsEditingNote(false); setActiveEditorNote({ type, targetId: tid, content: '', title: type === 'article' ? `Notes on ${articles.find(a => a.id === tid)?.metadata?.title || 'Article'}` : 'New Note' }); }} />
      <AddSourceModal isOpen={isAddSourceModalOpen} onClose={() => setIsAddSourceModalOpen(false)} onAddSource={handleAddSource} onAddPDF={handleAddPDF} />
      <GenerateModal isOpen={isGenerateModalOpen} onClose={() => setIsGenerateModalOpen(false)} onConfirm={handleGenerateConfirm} />
      {activeEditorNote && <NotebookEditor isOpen={!!activeEditorNote} initialData={activeEditorNote} onClose={() => setActiveEditorNote(null)} onSave={async (nd) => { let nn: Note; if(isEditingNote && nd.id) { nn = { ...notes.find(x => x.id === nd.id)!, ...nd } as Note; } else { nn = { id: crypto.randomUUID(), createdAt: Date.now(), title: nd.title || 'Untitled', content: nd.content || '', type: nd.type || 'general', targetId: nd.targetId }; } await saveNoteToDB(nn); setNotes(prev => isEditingNote ? prev.map(x => x.id === nn.id ? nn : x) : [...prev, nn]); if(selectedNote?.id === nn.id) setSelectedNote(nn); }} isEditing={isEditingNote} />}
      <NoteViewerModal note={selectedNote} onClose={() => setSelectedNote(null)} onUpdateTitle={(id, t) => { const idx = notes.findIndex(x => x.id === id); if(idx !== -1) { const un = { ...notes[idx], title: t }; saveNoteToDB(un); setNotes(n => n.map(x => x.id === id ? un : x)); if(selectedNote?.id === id) setSelectedNote(un); } }} onDelete={(id) => { deleteNoteFromDB(id); setNotes(n => n.filter(x => x.id !== id)); setSelectedNote(null); }} onEdit={(n) => { setSelectedNote(null); setIsEditingNote(true); setActiveEditorNote(n); }} />
    </div>
  );
};

const App = () => (
  <Suspense fallback={<div className="h-screen w-screen flex items-center justify-center bg-slate-50 text-slate-500 italic">Initializing Librarian...</div>}><LibrarianApp /></Suspense>
);
createRoot(document.getElementById('root')!).render(<App />);
