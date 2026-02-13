
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

    if (refreshSourceId && !window.confirm("Sync Library? Existing metadata for matching file paths will be protected.")) {
      return;
    }

    setIsLoading(true);
    setLoadingMessage('Syncing Path Registry...');
    
    try {
        const fileList: File[] = Array.from(files);
        let currentArticles = [...articles];
        let currentSources = [...sources];
        let newSourcesAdded: Source[] = [];
        
        const getDescendantSourceIds = (id: string, srcList: Source[]): string[] => {
            const results = [id];
            srcList.filter(s => s.parentId === id).forEach(child => {
                results.push(...getDescendantSourceIds(child.id, srcList));
            });
            return results;
        };

        if (refreshSourceId) {
            const branchIds = getDescendantSourceIds(refreshSourceId, sources);
            currentArticles = articles.filter(a => !branchIds.includes(a.sourceId));
            currentSources = sources.filter(s => s.id === refreshSourceId || !branchIds.includes(s.id));
        }

        const getOrCreateSourceInWorking = (folderName: string, parentId: string | undefined): string => {
            let existing = currentSources.find(s => s.name === folderName && s.parentId === parentId);
            if (!existing) existing = newSourcesAdded.find(s => s.name === folderName && s.parentId === parentId);
            if (existing) return existing.id;
            const id = crypto.randomUUID();
            const newSource: Source = { id, name: folderName, parentId, order: 0 };
            newSourcesAdded.push(newSource);
            return id;
        };

        let reLinkedCount = 0;
        let newAddedCount = 0;

        for (const file of fileList) {
            if (!file.name.toLowerCase().endsWith('.pdf')) continue;
            let relativePath = (file as any).webkitRelativePath || file.name;
            const pathParts = relativePath.split('/');
            let currentParentId: string | undefined = refreshSourceId || undefined;

            if (pathParts.length > 1) {
                const folders = pathParts.slice(0, -1);
                const startIdx = refreshSourceId ? 1 : 0; 
                for (let i = startIdx; i < folders.length; i++) {
                    currentParentId = getOrCreateSourceInWorking(folders[i], currentParentId);
                }
            } else if (!refreshSourceId) {
                currentParentId = getOrCreateSourceInWorking("Master Library", undefined);
            }

            const match = articles.find(a => a.filePath === relativePath);
            if (match) {
                currentArticles.push({ ...match, sourceId: currentParentId! });
                fileMap.current.set(match.id, file);
                reLinkedCount++;
            } else {
                const articleId = crypto.randomUUID();
                currentArticles.push({
                    id: articleId,
                    sourceId: currentParentId!,
                    fileName: file.name,
                    filePath: relativePath,
                    fileSize: file.size,
                    addedAt: Date.now(),
                    status: 'completed',
                    metadata: createMetadata(file)
                });
                fileMap.current.set(articleId, file);
                newAddedCount++;
            }
        }

        setArticles(currentArticles);
        setSources([...currentSources, ...newSourcesAdded]);
        setFileTick(t => t + 1);
        alert(`Sync Complete\n\n- Protected (Metadata Kept): ${reLinkedCount}\n- New Discovered: ${newAddedCount}`);
    } catch (err) {
        console.error(err);
        alert("Operation failed.");
    } finally {
        setIsLoading(false);
        if (e.target) e.target.value = "";
    }
  };

  const handleGenerateOutput = (options: any) => {
    const selectedArticles = articles.filter(a => checkedArticleIds.has(a.id));
    
    // 1. Export BiBTeX file if references selected
    if (options.references) {
        let bibOutput = "";
        selectedArticles.forEach(a => {
            const m = a.metadata;
            if (m) {
                const key = (m.authors[0]?.split(' ').pop() || 'Unknown') + (m.year || '0000');
                bibOutput += `@article{${key.toLowerCase()},
  title = {${m.title}},
  author = {${m.authors.join(' and ')}},
  journal = {${m.journal || ''}},
  year = {${m.year}},
  volume = {${m.volume || ''}},
  number = {${m.number || ''}},
  doi = {${m.doi || ''}},
  url = {${m.url || ''}}
}\n\n`;
            }
        });

        const bibBlob = new Blob([bibOutput], { type: 'text/x-bibtex' });
        const bibUrl = URL.createObjectURL(bibBlob);
        const bibLink = document.createElement('a');
        bibLink.href = bibUrl;
        bibLink.download = `library_references.bib`;
        bibLink.click();
        URL.revokeObjectURL(bibUrl);
    }

    // 2. Export Notes if selected
    if (options.notes) {
        let notesOutput = "";
        const format = options.format || '.md';
        
        // Sorting sequence buckets: General -> Category -> Article
        const generalNotes = notes.filter(n => n.type === 'general' && options.notesOptions.general);
        const categoryNotes = notes.filter(n => n.type === 'category' && options.notesOptions.category);
        const articleNotes = notes.filter(n => n.type === 'article' && options.notesOptions.article && checkedArticleIds.has(n.targetId || ''));

        if (format === '.tex') {
            notesOutput += `\\documentclass{article}\n\n\\title{Session Report}\n\\date{\\today}\n\n\\begin{document}\n\n\\maketitle\n\n`;
        } else {
            notesOutput += `# Session Report\n\n`;
        }

        // General Notes
        if (generalNotes.length > 0) {
            if (format === '.tex') {
                notesOutput += `\\section{General Notes}\n`;
                generalNotes.forEach(n => {
                    notesOutput += `\\subsection{${n.title}}\n${n.content}\n\n`;
                });
            } else {
                notesOutput += `## General Notes\n\n`;
                generalNotes.forEach(n => {
                    notesOutput += `### ${n.title}\n${n.content}\n\n`;
                });
            }
        }

        // Category Notes
        if (categoryNotes.length > 0) {
            if (format === '.tex') {
                notesOutput += `\\section{Category Notes}\n`;
                categoryNotes.forEach(n => {
                    notesOutput += `\\subsection{${n.targetId || 'Unknown Category'}}\n\\textbf{Note: ${n.title}}\\\\\n${n.content}\n\n`;
                });
            } else {
                notesOutput += `## Category Notes\n\n`;
                categoryNotes.forEach(n => {
                    notesOutput += `### ${n.targetId || 'Unknown Category'}: ${n.title}\n${n.content}\n\n`;
                });
            }
        }

        // Article Notes
        if (articleNotes.length > 0) {
            if (format === '.tex') {
                notesOutput += `\\section{Article Notes}\n`;
                articleNotes.forEach(n => {
                    const art = articles.find(a => a.id === n.targetId);
                    const artName = art?.metadata?.title || art?.fileName || 'Unknown Article';
                    notesOutput += `\\subsection{${artName}}\n\\textbf{Note: ${n.title}}\\\\\n${n.content}\n\n`;
                });
            } else {
                notesOutput += `## Article Notes\n\n`;
                articleNotes.forEach(n => {
                    const art = articles.find(a => a.id === n.targetId);
                    const artName = art?.metadata?.title || art?.fileName || 'Unknown Article';
                    notesOutput += `### ${artName}: ${n.title}\n${n.content}\n\n`;
                });
            }
        }

        if (format === '.tex') {
            notesOutput += `\n\\end{document}`;
        }

        const notesBlob = new Blob([notesOutput], { type: format === '.tex' ? 'text/x-tex' : 'text/markdown' });
        const notesUrl = URL.createObjectURL(notesBlob);
        const notesLink = document.createElement('a');
        notesLink.href = notesUrl;
        notesLink.download = `librarian_notes${format}`;
        notesLink.click();
        URL.revokeObjectURL(notesUrl);
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
    if (!window.confirm("Remove this entry?")) return;
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
    <div className="flex h-screen w-screen bg-slate-50 dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100 overflow-hidden">
      <Sidebar 
        sources={sources} articles={articles} notes={notes} categories={categories} activeSourceId={activeSourceId} activeCategoryId={activeCategoryId}
        onSetActiveSource={setActiveSourceId} onSetActiveCategory={setActiveCategoryId} onOpenAddModal={() => setIsAddSourceModalOpen(true)}
        onOpenGenerateModal={() => setIsGenerateModalOpen(true)} onOpenSettings={() => setIsSettingsOpen(true)} onOpenNote={setSelectedNote}
        onDeleteSource={handleDeleteSource} isGenerateDisabled={checkedArticleIds.size === 0} onRefreshSource={handleAddSource}
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
                    alert("Session Restored. Relink PDFs by syncing root folders."); 
                }
              } catch (err) { alert("Invalid file."); }
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
      
      <NotebookModal isOpen={isNotebookSetupOpen} onClose={() => setIsNotebookSetupOpen(false)} articles={articles} categories={categories} 
        onConfirm={(type, tid) => {
          const title = type === 'general' ? 'General Commentary' : type === 'category' ? `Note on ${tid}` : 'Reading Response';
          setActiveEditorNote({ type, targetId: tid, content: '', title });
        }} 
      />

      <AddSourceModal isOpen={isAddSourceModalOpen} onClose={() => setIsAddSourceModalOpen(false)} onAddSource={handleAddSource} onAddPDF={() => alert("Root folder import recommended.")} />
      <GenerateModal isOpen={isGenerateModalOpen} onClose={() => setIsGenerateModalOpen(false)} onConfirm={handleGenerateOutput} />
      
      {activeEditorNote && (
        <NotebookEditor isOpen={!!activeEditorNote} initialData={activeEditorNote} onClose={() => setActiveEditorNote(null)} onSave={(nd) => {
          const nn = { ...nd, id: nd.id || crypto.randomUUID(), createdAt: nd.createdAt || Date.now() } as Note;
          setNotes(prev => { 
            const idx = prev.findIndex(x => x.id === nn.id); 
            if (idx !== -1) { const nxt = [...prev]; nxt[idx] = nn; return nxt; } 
            return [...prev, nn]; 
          });
        }} isEditing={isEditingNote} />
      )}

      <NoteViewerModal note={selectedNote} onClose={() => setSelectedNote(null)} onUpdateTitle={(id, t) => setNotes(prev => prev.map(n => n.id === id ? {...n, title: t} : n))} onDelete={(id) => setNotes(prev => prev.filter(n => n.id !== id))} onEdit={(n) => { setSelectedNote(null); setIsEditingNote(true); setActiveEditorNote(n); }} />
      
      <button 
        onClick={() => setIsNotebookSetupOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-2xl flex items-center justify-center transition-all active:scale-95 z-[100]"
        title="Quick Note"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth={2.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
      </button>

      {isLoading && (
          <div className="fixed inset-0 z-[200] bg-black/60 flex items-center justify-center backdrop-blur-sm">
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
  <Suspense fallback={<div className="h-screen w-screen flex items-center justify-center bg-slate-50">Librarian Initializing...</div>}><LibrarianApp /></Suspense>
);
createRoot(document.getElementById('root')!).render(<App />);
