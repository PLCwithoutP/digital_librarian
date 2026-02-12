
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

  const createMetadata = (file: File): ArticleMetadata => ({
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
  });

  const handleAddSource = async (e: React.ChangeEvent<HTMLInputElement>, refreshSourceId?: string) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setIsLoading(true);
    setLoadingMessage(refreshSourceId ? 'Syncing library content...' : 'Indexing folder...');
    
    try {
        const fileList: File[] = Array.from(files);
        const newSources: Source[] = [];
        const newArticlesList: Article[] = [];

        // Recursive source builder
        const getOrCreateSource = (folderName: string, parentId: string | undefined): string => {
            let existing = sources.find(s => s.name === folderName && s.parentId === parentId);
            if (!existing) existing = newSources.find(s => s.name === folderName && s.parentId === parentId);
            
            if (existing) return existing.id;

            const id = crypto.randomUUID();
            const newSource: Source = { id, name: folderName, parentId, order: 0 };
            newSources.push(newSource);
            return id;
        };

        let newCount = 0;
        let updateCount = 0;

        for (const file of fileList) {
            if (!file.name.toLowerCase().endsWith('.pdf')) continue;
            const relativePath = (file as any).webkitRelativePath || file.name;
            
            // SMART MERGE: Match by Relative Path
            let existingArticle = articles.find(a => a.filePath === relativePath);
            
            if (existingArticle) {
                // Just update the File reference in memory
                fileMap.current.set(existingArticle.id, file);
                updateCount++;
                continue;
            }

            // Create source hierarchy for truly new files
            const pathParts = relativePath.split('/');
            let currentParentId: string | undefined = refreshSourceId || undefined;

            if (pathParts.length > 1) {
                const folders = pathParts.slice(0, -1);
                for (const folderName of folders) {
                    currentParentId = getOrCreateSource(folderName, currentParentId);
                }
            } else if (!refreshSourceId) {
                currentParentId = getOrCreateSource("Root Imports", undefined);
            }

            const articleId = crypto.randomUUID();
            const newArt: Article = {
                id: articleId,
                sourceId: currentParentId!,
                fileName: file.name,
                filePath: relativePath,
                fileSize: file.size,
                addedAt: Date.now(),
                status: 'completed',
                metadata: createMetadata(file)
            };
            fileMap.current.set(articleId, file);
            newArticlesList.push(newArt);
            newCount++;
        }

        if (newSources.length > 0) setSources(prev => [...prev, ...newSources]);
        if (newArticlesList.length > 0) setArticles(prev => [...prev, ...newArticlesList]);
        
        if (refreshSourceId) {
            alert(`Sync Finished!\nFound ${newCount} new documents.\nRe-linked ${updateCount} existing documents.`);
        }
    } catch (err) {
        console.error(err);
        alert("Action failed. Please check browser permissions for local file access.");
    } finally {
        setIsLoading(false);
        if (e.target) e.target.value = "";
    }
  };

  const handleCreateVirtualGroup = () => {
    const name = window.prompt("Enter Group name:");
    if (!name || !name.trim()) return;
    const newGroup: Source = {
      id: crypto.randomUUID(),
      name: name.trim(),
      isVirtual: true,
      order: sources.length
    };
    setSources(prev => [...prev, newGroup]);
  };

  const handleMoveSource = (sourceId: string, targetParentId: string | null) => {
    if (sourceId === targetParentId) return;

    setSources(prev => {
        const sourceToMove = prev.find(s => s.id === sourceId);
        if (!sourceToMove) return prev;
        
        // Prevent moving a Virtual Group into anything else
        if (sourceToMove.isVirtual && targetParentId !== null) {
            alert("Groups must remain at the top level.");
            return prev;
        }

        // Cycle check: moving a folder into its own descendant
        const isDescendant = (parent: string, child: string): boolean => {
            const c = prev.find(s => s.id === child);
            if (!c || !c.parentId) return false;
            if (c.parentId === parent) return true;
            return isDescendant(parent, c.parentId);
        };
        if (targetParentId && isDescendant(sourceId, targetParentId)) {
            alert("Cannot move a folder into its own subfolder.");
            return prev;
        }

        return prev.map(s => s.id === sourceId ? { ...s, parentId: targetParentId || undefined } : s);
    });
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
    const source = sources.find(s => s.id === id);
    const msg = source?.isVirtual ? "Delete this group? (Folders inside will be moved to root)" : "Remove this folder and all documents inside?";
    if (!window.confirm(msg)) return;

    if (source?.isVirtual) {
        setSources(prev => prev.filter(s => s.id !== id).map(s => s.parentId === id ? { ...s, parentId: undefined } : s));
    } else {
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
    }
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
        a.metadata?.year.toLowerCase().includes(q)
      ));
    }
    return [...list];
  }, [articles, activeSourceId, activeCategoryId, searchQuery, sources]);

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
        onRefreshSource={handleAddSource}
        onCreateGroup={handleCreateVirtualGroup}
        onMoveSource={handleMoveSource}
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
                    alert("Import successful. Click Refresh on folders to re-link your local PDF files.");
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
        article={articles.find(a => a.id === selectedArticleId)}
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
      <AddSourceModal isOpen={isAddSourceModalOpen} onClose={() => setIsAddSourceModalOpen(false)} onAddSource={handleAddSource} onAddPDF={() => alert("Add PDFs via 'Import Folder' for full tree support.")} />
      <GenerateModal isOpen={isGenerateModalOpen} onClose={() => setIsGenerateModalOpen(false)} onConfirm={() => alert("Export initiated.")} />
      
      {activeEditorNote && <NotebookEditor isOpen={!!activeEditorNote} initialData={activeEditorNote} onClose={() => setActiveEditorNote(null)} onSave={(nd) => {
          const nn = { ...nd, id: nd.id || crypto.randomUUID(), createdAt: nd.createdAt || Date.now() } as Note;
          setNotes(prev => {
              const idx = prev.findIndex(x => x.id === nn.id);
              if (idx !== -1) { const next = [...prev]; next[idx] = nn; return next; }
              return [...prev, nn];
          });
      }} isEditing={isEditingNote} />}

      <NoteViewerModal note={selectedNote} onClose={() => setSelectedNote(null)} onUpdateTitle={(id, t) => setNotes(prev => prev.map(n => n.id === id ? {...n, title: t} : n))} onDelete={(id) => setNotes(prev => prev.filter(n => n.id !== id))} onEdit={(n) => { setSelectedNote(null); setIsEditingNote(true); setActiveEditorNote(n); }} />
      
      {isLoading && (
          <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center backdrop-blur-sm">
              <div className="bg-white dark:bg-slate-900 p-10 rounded-2xl shadow-2xl flex flex-col items-center border border-slate-200 dark:border-slate-800">
                  <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-6"></div>
                  <p className="text-xl font-bold text-slate-900 dark:text-white uppercase tracking-widest">{loadingMessage}</p>
              </div>
          </div>
      )}
    </div>
  );
};

const App = () => (
  <Suspense fallback={<div className="h-screen w-screen flex items-center justify-center bg-slate-50">Initializing...</div>}><LibrarianApp /></Suspense>
);
createRoot(document.getElementById('root')!).render(<App />);
