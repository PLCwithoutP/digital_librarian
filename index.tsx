
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
  
  // This registry links an Article ID to a live browser File object.
  const fileMap = useRef<Map<string, File>>(new Map());
  const [, setFileTick] = useState(0);

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

    if (refreshSourceId && !window.confirm("Refresh this folder? Metadata for existing paths will be preserved. New files will be added. Missing files will be removed.")) {
      return;
    }

    setIsLoading(true);
    setLoadingMessage(refreshSourceId ? 'Syncing paths...' : 'Mapping folder...');
    
    try {
        const fileList: File[] = Array.from(files);
        const newSources: Source[] = [];
        const finalArticles: Article[] = [...articles];
        
        // When refreshing, we need to know which articles belonged to the original root source tree
        const getDescendantSourceIds = (id: string): string[] => {
            const results = [id];
            sources.filter(s => s.parentId === id).forEach(child => {
                results.push(...getDescendantSourceIds(child.id));
            });
            return results;
        };

        const refreshedSourceIds = refreshSourceId ? getDescendantSourceIds(refreshSourceId) : [];
        const refreshedPathsInState = new Map<string, Article>();
        if (refreshSourceId) {
            articles.forEach(a => {
                if (refreshedSourceIds.includes(a.sourceId)) {
                    refreshedPathsInState.set(a.filePath, a);
                }
            });
        }

        const getOrCreateSource = (folderName: string, parentId: string | undefined): string => {
            let existing = sources.find(s => s.name === folderName && s.parentId === parentId);
            if (!existing) existing = newSources.find(s => s.name === folderName && s.parentId === parentId);
            if (existing) return existing.id;
            const id = crypto.randomUUID();
            const newSource: Source = { id, name: folderName, parentId, order: 0 };
            newSources.push(newSource);
            return id;
        };

        const processedPathsInNewScan = new Set<string>();
        let reLinkedCount = 0;
        let newAddedCount = 0;

        for (const file of fileList) {
            if (!file.name.toLowerCase().endsWith('.pdf')) continue;
            let relativePath = (file as any).webkitRelativePath || file.name;

            // If we're refreshing a specific folder, let's normalize the path.
            // If user selects "MyDocs" folder and it contains "Doc1.pdf", 
            // webkitRelativePath is "MyDocs/Doc1.pdf".
            // If our state already knows this path, we link it.
            
            processedPathsInNewScan.add(relativePath);

            // 1. Check if this path exists anywhere in our state
            const existingInState = articles.find(a => a.filePath === relativePath);

            if (existingInState) {
                // Path match! Project existing metadata onto the new physical file
                fileMap.current.set(existingInState.id, file);
                reLinkedCount++;
                continue;
            }

            // 2. Not in state: Add as new
            const pathParts = relativePath.split('/');
            let currentParentId: string | undefined = refreshSourceId || undefined;

            if (pathParts.length > 1) {
                const folders = pathParts.slice(0, -1);
                // If we're refreshing, the first part of webkitRelativePath is the folder we selected.
                // We skip creating a new source for the selected root itself to prevent "A/A/file.pdf"
                const startIdx = refreshSourceId ? 1 : 0; 
                for (let i = startIdx; i < folders.length; i++) {
                    currentParentId = getOrCreateSource(folders[i], currentParentId);
                }
            } else if (!refreshSourceId) {
                currentParentId = getOrCreateSource("Root Library", undefined);
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
            finalArticles.push(newArt);
            newAddedCount++;
        }

        // 3. Remove orphaned articles (only if refreshing)
        let removedCount = 0;
        if (refreshSourceId) {
            const articlesAfterCleanup = finalArticles.filter(a => {
                // If it wasn't part of the refreshed tree, keep it.
                if (!refreshedSourceIds.includes(a.sourceId)) return true;
                // If it was part of refreshed tree but not found in the new file scan, remove it.
                if (!processedPathsInNewScan.has(a.filePath)) {
                    fileMap.current.delete(a.id);
                    removedCount++;
                    return false;
                }
                return true;
            });
            setArticles(articlesAfterCleanup);
        } else {
            setArticles(finalArticles);
        }

        if (newSources.length > 0) setSources(prev => [...prev, ...newSources]);
        
        setFileTick(t => t + 1);
        alert(`Sync Finished!\n- Matched & Re-linked: ${reLinkedCount}\n- New discovered: ${newAddedCount}\n- Missing/Removed: ${removedCount}`);
    } catch (err) {
        console.error(err);
        alert("Operation failed. Ensure the folder is accessible.");
    } finally {
        setIsLoading(false);
        if (e.target) e.target.value = "";
    }
  };

  const handleCreateVirtualGroup = () => {
    const name = window.prompt("New Group Name:");
    if (!name?.trim()) return;
    setSources(prev => [...prev, { id: crypto.randomUUID(), name: name.trim(), isVirtual: true, order: prev.length }]);
  };

  const handleAssignFolderToGroup = (folderId: string, groupId: string | null) => {
    setSources(prev => prev.map(s => s.id === folderId ? { ...s, parentId: groupId || undefined } : s));
  };

  const handleUpdateArticle = (id: string, updates: Partial<ArticleMetadata>) => {
    setArticles(prev => prev.map(a => a.id === id ? { ...a, metadata: { ...a.metadata!, ...updates } } : a));
  };

  const handleDeleteSource = (id: string) => {
    const source = sources.find(s => s.id === id);
    if (!window.confirm(source?.isVirtual ? "Delete UI Group?" : "Delete folder and all PDFs inside?")) return;
    if (source?.isVirtual) {
        setSources(prev => prev.filter(s => s.id !== id).map(s => s.parentId === id ? { ...s, parentId: undefined } : s));
    } else {
        const toDelete = new Set<string>([id]);
        const findChildren = (pid: string) => sources.filter(s => s.parentId === pid).forEach(c => { toDelete.add(c.id); findChildren(c.id); });
        findChildren(id);
        setArticles(prev => prev.filter(a => !toDelete.has(a.sourceId)));
        setSources(prev => prev.filter(s => !toDelete.has(s.id)));
    }
  };

  const filteredArticles = useMemo(() => {
    let list = articles;
    if (activeSourceId) {
        const branch = new Set<string>([activeSourceId]);
        const findSub = (pid: string) => sources.filter(s => s.parentId === pid).forEach(c => { branch.add(c.id); findSub(c.id); });
        findSub(activeSourceId);
        list = list.filter(a => branch.has(a.sourceId));
    }
    if (activeCategoryId) list = list.filter(a => a.metadata?.categories.includes(activeCategoryId));
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(a => (
        a.fileName.toLowerCase().includes(q) || a.metadata?.title.toLowerCase().includes(q) ||
        a.metadata?.authors.some(auth => auth.toLowerCase().includes(q)) ||
        a.metadata?.keywords.some(k => k.toLowerCase().includes(q))
      ));
    }
    return [...list];
  }, [articles, activeSourceId, activeCategoryId, searchQuery, sources]);

  return (
    <div className="flex h-screen w-screen bg-slate-50 dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100 overflow-hidden transition-colors duration-200">
      <Sidebar 
        sources={sources} articles={articles} notes={notes} categories={categories} activeSourceId={activeSourceId} activeCategoryId={activeCategoryId}
        onSetActiveSource={setActiveSourceId} onSetActiveCategory={setActiveCategoryId} onOpenAddModal={() => setIsAddSourceModalOpen(true)}
        onOpenGenerateModal={() => setIsGenerateModalOpen(true)} onOpenSettings={() => setIsSettingsOpen(true)} onOpenNote={setSelectedNote}
        onDeleteSource={handleDeleteSource} isGenerateDisabled={articles.length === 0} onRefreshSource={handleAddSource}
        onCreateGroup={handleCreateVirtualGroup} onMoveSource={handleAssignFolderToGroup}
      />

      <ArticleList 
        articles={filteredArticles} selectedArticleId={selectedArticleId} onSelectArticle={setSelectedArticleId}
        checkedArticleIds={checkedArticleIds} onToggleArticle={(id) => setCheckedArticleIds(prev => {
            const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next;
        })}
        onToggleAll={(ids) => setCheckedArticleIds(new Set(ids))}
        searchQuery={searchQuery} onSearchChange={setSearchQuery}
        fileStatusMap={fileMap.current}
        onSaveSession={() => {
            const blob = new Blob([JSON.stringify({ sources, articles, notes }, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = 'librarian_session.json'; a.click();
            URL.revokeObjectURL(url);
        }}
        onImportSession={() => {
            const input = document.createElement('input'); input.type = 'file'; input.accept = '.json';
            input.onchange = async (e) => {
              const file = (e.target as HTMLInputElement).files?.[0]; if (!file) return;
              try {
                const data = JSON.parse(await file.text());
                if (data.articles) { 
                    setSources(data.sources || []); 
                    setArticles(data.articles); 
                    setNotes(data.notes || []); 
                    fileMap.current.clear();
                    setFileTick(t => t + 1);
                    alert("Session metadata restored. Your PDFs are currently unlinked. Please click 'Sync' on the root folders to re-establish connections via matching paths."); 
                }
              } catch (err) { alert("Invalid session file."); }
            };
            input.click();
        }}
        onDeleteSelected={() => { setArticles(prev => prev.filter(a => !checkedArticleIds.has(a.id))); setCheckedArticleIds(new Set()); }}
        isGrouped={isGrouped} onToggleGroup={() => setIsGrouped(!isGrouped)}
        sortConfig={sortConfig} onSort={(key) => setSortConfig(curr => curr?.key === key ? { key, direction: curr.direction === 'asc' ? 'desc' : 'asc' } : { key, direction: 'asc' })}
      />

      <ArticleDetail 
        article={articles.find(a => a.id === selectedArticleId)} notes={notes} onClose={() => setSelectedArticleId(null)}
        onUpdateMetadata={handleUpdateArticle} onEditNote={(n) => { setSelectedNote(null); setIsEditingNote(!!n.id); setActiveEditorNote(n); }}
        onOpenNote={setSelectedNote} onDeleteNote={(id) => setNotes(prev => prev.filter(n => n.id !== id))}
        getPDF={(id) => fileMap.current.get(id)}
      />

      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} currentTheme={theme} onThemeChange={setTheme} />
      <NotebookModal isOpen={isNotebookSetupOpen} onClose={() => setIsNotebookSetupOpen(false)} articles={articles} categories={categories} onConfirm={(type, tid) => setActiveEditorNote({ type, targetId: tid, content: '', title: 'New Note' })} />
      <AddSourceModal isOpen={isAddSourceModalOpen} onClose={() => setIsAddSourceModalOpen(false)} onAddSource={handleAddSource} onAddPDF={() => alert("Please add the root folder containing your PDFs to ensure unique path mapping.")} />
      <GenerateModal isOpen={isGenerateModalOpen} onClose={() => setIsGenerateModalOpen(false)} onConfirm={() => alert("Export started.")} />
      
      {activeEditorNote && <NotebookEditor isOpen={!!activeEditorNote} initialData={activeEditorNote} onClose={() => setActiveEditorNote(null)} onSave={(nd) => {
          const nn = { ...nd, id: nd.id || crypto.randomUUID(), createdAt: nd.createdAt || Date.now() } as Note;
          setNotes(prev => { const idx = prev.findIndex(x => x.id === nn.id); if (idx !== -1) { const next = [...prev]; next[idx] = nn; return next; } return [...prev, nn]; });
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
