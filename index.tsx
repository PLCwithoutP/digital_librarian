
import React, { useState, useEffect, useMemo, Suspense, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { Article, Source, ArticleMetadata, Note, NoteType } from './types';
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
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [isGrouped, setIsGrouped] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [checkedArticleIds, setCheckedArticleIds] = useState<Set<string>>(new Set<string>());
  
  // In-memory file storage. Key is Article.id
  const fileMap = useRef<Map<string, File>>(new Map());

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

  const categories = useMemo(() => {
    const set = new Set<string>();
    articles.forEach(a => a.metadata?.categories.forEach(c => set.add(c)));
    return Array.from(set).sort();
  }, [articles]);

  const createMetadata = (file: File): ArticleMetadata => {
    return {
      title: file.name.replace(/\.pdf$/i, ''),
      authors: [],
      journal: "",
      volume: "",
      number: null,
      pages: "",
      doi: "",
      url: "",
      year: "Unknown",
      categories: ["Uncategorized"],
      keywords: [],
      abstract: "",
      bibtex: ""
    };
  };

  const handleAddSource = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setIsLoading(true);
    setLoadingMessage('Linking folder contents...');
    try {
        const fileList: File[] = Array.from(files);
        const pathSourceIdMap = new Map<string, string>();
        const newSources: Source[] = [];
        const newArticles: Article[] = [];

        const getOrCreateSource = (fullPath: string, folderName: string, parentPath: string | null): string => {
            if (pathSourceIdMap.has(fullPath)) return pathSourceIdMap.get(fullPath)!;
            const id = crypto.randomUUID();
            const parentId = parentPath ? pathSourceIdMap.get(parentPath) : undefined;
            const newSource: Source = { id, name: folderName, parentId };
            newSources.push(newSource);
            pathSourceIdMap.set(fullPath, id);
            return id;
        };

        for (const file of fileList) {
            if (!file.name.toLowerCase().endsWith('.pdf')) continue;
            const relativePath = (file as any).webkitRelativePath || file.name;
            
            // Re-linking logic: Use the original filePath/fileName from session to match
            let existing = articles.find(a => a.filePath === relativePath || (a.fileName === file.name));
            
            if (existing) {
                fileMap.current.set(existing.id, file);
                continue;
            }

            const pathParts = relativePath.split('/');
            let sourceId: string;
            
            if (pathParts.length > 1) {
                const folderParts = pathParts.slice(0, -1);
                let currentPath = "";
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

            const articleId = crypto.randomUUID();
            const newArt: Article = {
                id: articleId,
                sourceId,
                fileName: file.name,
                filePath: relativePath,
                fileSize: file.size,
                addedAt: Date.now(),
                status: 'completed',
                metadata: createMetadata(file)
            };
            
            fileMap.current.set(articleId, file);
            newArticles.push(newArt);
        }

        setSources(prev => [...prev, ...newSources]);
        setArticles(prev => [...prev, ...newArticles]);
    } catch (err) {
        console.error("Folder import failed", err);
    } finally {
        setIsLoading(false);
        if (e.target) e.target.value = "";
    }
  };

  const handleAddPDF = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;
      setIsLoading(true);
      setLoadingMessage('Linking PDFs...');
      try {
        let uploadSource = sources.find(s => s.name === "Uploaded Files");
        let sourceId = uploadSource?.id;
        if (!uploadSource) {
            sourceId = crypto.randomUUID();
            uploadSource = { id: sourceId, name: "Uploaded Files" };
            setSources(prev => [...prev, uploadSource!]);
        }

        const fileList: File[] = Array.from(files);
        const newArticles: Article[] = [];
        for (const file of fileList) {
            if (!file.name.toLowerCase().endsWith('.pdf')) continue;
            
            let existing = articles.find(a => a.fileName === file.name);
            if (existing) {
                fileMap.current.set(existing.id, file);
                continue;
            }

            const articleId = crypto.randomUUID();
            const article: Article = {
                id: articleId,
                sourceId: sourceId!,
                fileName: file.name,
                fileSize: file.size,
                addedAt: Date.now(),
                status: 'completed',
                metadata: createMetadata(file)
            };
            fileMap.current.set(articleId, file);
            newArticles.push(article);
        }
        setArticles(prev => [...prev, ...newArticles]);
      } catch(err) {
          console.error(err);
      } finally {
        setIsLoading(false);
        if (e.target) e.target.value = "";
      }
  };

  const handleUpdateArticle = (id: string, updates: Partial<ArticleMetadata>) => {
    setArticles(prev => {
        const idx = prev.findIndex(a => a.id === id);
        if (idx === -1) return prev;
        const newArr = [...prev];
        newArr[idx] = { ...newArr[idx], metadata: { ...newArr[idx].metadata!, ...updates } };
        return newArr;
    });
  };

  const handleDeleteSource = (id: string) => {
    if (!window.confirm("Remove this folder?")) return;
    const allSourceIdsToDelete = new Set<string>();
    const collectIds = (sid: string) => {
        allSourceIdsToDelete.add(sid);
        sources.filter(s => s.parentId === sid).forEach(c => collectIds(c.id));
    };
    collectIds(id);

    const articlesToRemove = articles.filter(a => allSourceIdsToDelete.has(a.sourceId));
    articlesToRemove.forEach(a => fileMap.current.delete(a.id));

    setSources(prev => prev.filter(s => !allSourceIdsToDelete.has(s.id)));
    setArticles(prev => prev.filter(a => !allSourceIdsToDelete.has(a.sourceId)));
  };

  const filteredArticles = useMemo(() => {
    let list = articles;
    if (activeSourceId) {
        const descendants = new Set<string>([activeSourceId]);
        const addDescendants = (parentId: string) => {
            sources.filter(s => s.parentId === parentId).forEach(c => {
                descendants.add(c.id);
                addDescendants(c.id);
            });
        };
        addDescendants(activeSourceId);
        list = list.filter(a => descendants.has(a.sourceId));
    }
    if (activeCategoryId) {
      list = list.filter(a => a.metadata?.categories.includes(activeCategoryId));
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(a => (
        a.fileName.toLowerCase().includes(q) ||
        a.metadata?.title.toLowerCase().includes(q) ||
        a.metadata?.authors.some(auth => auth.toLowerCase().includes(q)) ||
        a.metadata?.journal?.toLowerCase().includes(q) ||
        a.metadata?.year.toLowerCase().includes(q) ||
        a.metadata?.categories.some(c => c.toLowerCase().includes(q)) ||
        a.metadata?.keywords.some(k => k.toLowerCase().includes(q))
      ));
    }

    if (sortConfig) {
      list.sort((a, b) => {
        let valA: any = '', valB: any = '';
        switch(sortConfig.key) {
          case 'publication': valA = (a.metadata?.title || a.fileName).toLowerCase(); valB = (b.metadata?.title || b.fileName).toLowerCase(); break;
          case 'authors': valA = (a.metadata?.authors?.[0] || '').toLowerCase(); valB = (b.metadata?.authors?.[0] || '').toLowerCase(); break;
          case 'journal': valA = (a.metadata?.journal || '').toLowerCase(); valB = (b.metadata?.journal || '').toLowerCase(); break;
          case 'year': valA = String(a.metadata?.year || ''); valB = String(b.metadata?.year || ''); break;
        }
        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return [...list];
  }, [articles, activeSourceId, activeCategoryId, searchQuery, sources, sortConfig]);

  const selectedArticle = useMemo(() => 
    articles.find(a => a.id === selectedArticleId), 
    [articles, selectedArticleId]
  );

  return (
    <div className="flex h-screen w-screen bg-slate-50 dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100 overflow-hidden transition-colors duration-200">
      <Sidebar 
        sources={sources}
        articles={articles}
        notes={notes}
        categories={categories}
        activeSourceId={activeSourceId}
        activeCategoryId={activeCategoryId}
        onSetActiveSource={setActiveSourceId}
        onSetActiveCategory={setActiveCategoryId}
        onOpenAddModal={() => setIsAddSourceModalOpen(true)}
        onOpenGenerateModal={() => setIsGenerateModalOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenNote={setSelectedNote}
        onDeleteSource={handleDeleteSource}
        isGenerateDisabled={articles.length === 0}
      />

      <ArticleList 
        articles={filteredArticles}
        selectedArticleId={selectedArticleId}
        onSelectArticle={setSelectedArticleId}
        checkedArticleIds={checkedArticleIds}
        onToggleArticle={(id) => setCheckedArticleIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        })}
        onToggleAll={(ids) => setCheckedArticleIds(new Set(ids))}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSaveSession={() => {
            const blob = new Blob([JSON.stringify({ sources, articles, notes }, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'librarian_session.json';
            a.click();
            URL.revokeObjectURL(url);
        }}
        onImportSession={() => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';
            input.onchange = async (e) => {
              const file = (e.target as HTMLInputElement).files?.[0];
              if (!file) return;
              try {
                const text = await file.text();
                const data = JSON.parse(text);
                if (data.articles) {
                    setSources(data.sources || []);
                    setArticles(data.articles);
                    setNotes(data.notes || []);
                    alert("Session imported. Please use 'Add Folder' or 'Add PDF' to re-link your local PDF files.");
                }
              } catch (err) { alert("Invalid session file."); }
            };
            input.click();
        }}
        onDeleteSelected={() => {
            setArticles(prev => prev.filter(a => !checkedArticleIds.has(a.id)));
            checkedArticleIds.forEach(id => fileMap.current.delete(id));
            setCheckedArticleIds(new Set());
        }}
        isGrouped={isGrouped}
        onToggleGroup={() => setIsGrouped(!isGrouped)}
        sortConfig={sortConfig}
        onSort={(key) => {
            setSortConfig(curr => curr?.key === key ? { key, direction: curr.direction === 'asc' ? 'desc' : 'asc' } : { key, direction: 'asc' });
        }}
      />

      <ArticleDetail 
        article={selectedArticle}
        notes={notes}
        onClose={() => setSelectedArticleId(null)}
        onUpdateMetadata={handleUpdateArticle}
        onEditNote={(n) => { setSelectedNote(null); setIsEditingNote(!!n.id); setActiveEditorNote(n); }}
        onOpenNote={setSelectedNote}
        onDeleteNote={(id) => setNotes(prev => prev.filter(n => n.id !== id))}
        getPDF={(id) => fileMap.current.get(id)}
      />

      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} currentTheme={theme} onThemeChange={setTheme} />
      <NotebookModal isOpen={isNotebookSetupOpen} onClose={() => setIsNotebookSetupOpen(false)} articles={articles} categories={categories} onConfirm={(type, tid) => setActiveEditorNote({ type, targetId: tid, content: '', title: 'New Note' })} />
      <AddSourceModal isOpen={isAddSourceModalOpen} onClose={() => setIsAddSourceModalOpen(false)} onAddSource={handleAddSource} onAddPDF={handleAddPDF} />
      <GenerateModal isOpen={isGenerateModalOpen} onClose={() => setIsGenerateModalOpen(false)} onConfirm={() => alert("Exporting References and Notes...")} />
      
      {activeEditorNote && <NotebookEditor isOpen={!!activeEditorNote} initialData={activeEditorNote} onClose={() => setActiveEditorNote(null)} onSave={(nd) => {
          const nn = { ...nd, id: nd.id || crypto.randomUUID(), createdAt: nd.createdAt || Date.now() } as Note;
          setNotes(prev => {
              const idx = prev.findIndex(x => x.id === nn.id);
              if (idx !== -1) { const next = [...prev]; next[idx] = nn; return next; }
              return [...prev, nn];
          });
      }} isEditing={isEditingNote} />}

      <NoteViewerModal note={selectedNote} onClose={() => setSelectedNote(null)} onUpdateTitle={(id, t) => setNotes(prev => prev.map(n => n.id === id ? {...n, title: t} : n))} onDelete={(id) => setNotes(prev => prev.filter(n => n.id !== id))} onEdit={(n) => { setSelectedNote(null); setIsEditingNote(true); setActiveEditorNote(n); }} />
    </div>
  );
};

const App = () => (
  <Suspense fallback={<div className="h-screen w-screen flex items-center justify-center bg-slate-50">Initializing...</div>}><LibrarianApp /></Suspense>
);
createRoot(document.getElementById('root')!).render(<App />);
