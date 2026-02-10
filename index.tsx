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

// Helper to generate a BibTeX key and entry client-side
const generateBibtexEntry = (art: Article) => {
  const m = art.metadata!;
  const year = m.year && m.year !== "Unknown" ? m.year : "0000";
  const authors = m.authors || [];
  
  let lastName = "anon";
  if (authors.length > 0) {
    const parts = authors[0].split(' ');
    lastName = parts[parts.length - 1].toLowerCase().replace(/[^a-z0-9]/g, '');
  }
  
  const titleWords = (m.title || "").split(/\s+/).filter(w => w.length > 3);
  const firstTitleWord = (titleWords[0] || "entry").toLowerCase().replace(/[^a-z0-9]/g, '');
  const bibKey = `${lastName}${year}${firstTitleWord}`;
  
  const authorsStr = authors.join(' and ');
  let bib = `@misc{${bibKey},\n`;
  if (authorsStr) bib += `  author = {${authorsStr}},\n`;
  bib += `  title = {${m.title || ""}},\n`;
  bib += `  year = {${year}},\n`;
  if (m.journal) bib += `  journal = {${m.journal}},\n`;
  if (m.volume) bib += `  volume = {${m.volume}},\n`;
  if (m.number) bib += `  number = {${m.number}},\n`;
  if (m.pages) bib += `  pages = {${m.pages}},\n`;
  if (m.doi) bib += `  doi = {${m.doi}},\n`;
  if (m.url) bib += `  url = {${m.url}},\n`;
  bib += `  howpublished = {PDF},\n`;
  bib += `  note = {Local PDF: ${art.fileName}},\n`;
  bib += `  file = {${art.filePath || art.fileName}}\n`;
  bib += `}`;
  
  return { key: bibKey, bib };
};

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
        console.error("Failed to load session", err);
      } finally {
        setIsLoading(false);
      }
    };
    initSession();
  }, []);

  const categories = useMemo(() => {
    const set = new Set<string>();
    articles.forEach(a => a.metadata?.categories.forEach(c => set.add(c)));
    return Array.from(set).sort();
  }, [articles]);

  const handleExportMetadata = (targetArticles?: Article[], fileName: string = 'metadata.json') => {
    const list = targetArticles || (activeSourceId || activeCategoryId || searchQuery ? filteredArticles : articles);
    
    if (list.length === 0) {
      alert("No articles to export metadata for.");
      return;
    }

    const exportData = {
      root_path: list[0]?.filePath?.split('/')[0] || "Librarian Library",
      generated_at: new Date().toISOString().split('.')[0],
      pdf_count: list.length,
      pdfs: list.map(art => ({
        file_path: art.filePath || art.fileName,
        file_name: art.fileName,
        title: art.metadata?.title || "",
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
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportBibtex = (targetArticles?: Article[]) => {
    const list = targetArticles || articles;
    if (list.length === 0) return;

    const bibContent = list.map(art => generateBibtexEntry(art).bib).join('\n\n');

    const blob = new Blob([bibContent], { type: 'text/plain' });
    const url: string = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'references.bib';
    a.click();
    URL.revokeObjectURL(url);
  };

  const processMetadataFiles = async (files: File[]): Promise<Map<string, any>> => {
      // Specifically look for metadata.json in the file list
      const metadataFiles = files.filter(f => f.name.toLowerCase() === 'metadata.json');
      const pdfMetadataMap = new Map<string, any>();

      for (const jsonFile of metadataFiles) {
          try {
              const text: string = await jsonFile.text();
              const data = JSON.parse(text);
              if (data.pdfs && Array.isArray(data.pdfs)) {
                  data.pdfs.forEach((pdf: any) => {
                      if (pdf.file_name) pdfMetadataMap.set(pdf.file_name, pdf);
                  });
              }
              // Legacy support for 'entries' key if used previously
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
              authors: Array.isArray(meta.authors) ? meta.authors : [],
              journal: meta.journal || "",
              volume: meta.volume || "",
              number: meta.number || null,
              pages: meta.pages || "",
              doi: meta.doi || "",
              url: meta.url || "",
              year: meta.year ? String(meta.year) : "Unknown",
              abstract: meta.abstract || "",
              keywords: Array.isArray(meta.keywords) ? meta.keywords : [],
              categories: Array.isArray(meta.categories) ? meta.categories : ["Uncategorized"],
              bibtex: meta.bibtex || "" 
          };
      } else {
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
      }
  };

  const handleAddSource = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setIsLoading(true);
    setLoadingMessage('Importing folder contents...');
    try {
        const fileList: File[] = Array.from(files);
        const pathSourceIdMap = new Map<string, string>();
        const newSources: Source[] = [];
        const pdfMetadataMap = await processMetadataFiles(fileList);
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

            const meta = pdfMetadataMap.get(file.name);
            const articleMetadata = createMetadata(file, meta);
            const articleId = crypto.randomUUID();
            
            const newArt: Article = {
                id: articleId,
                sourceId,
                fileName: file.name,
                filePath: relativePath,
                fileSize: file.size,
                addedAt: Date.now(),
                status: 'completed',
                metadata: articleMetadata
            };
            newArticles.push(newArt);
            await saveFileToDB(articleId, file);
            await saveArticleToDB(newArt);
        }

        for (const s of newSources) await saveSourceToDB(s);

        setSources(prev => [...prev, ...newSources]);
        setArticles(prev => [...prev, ...newArticles]);
        
        // Removed: handleExportMetadata(newArticles, 'metadata.json');
        // Users now manually export to "create" the file if needed.
        
    } catch (err) {
        console.error("Folder import failed", err);
        alert("Failed to import folder.");
    } finally {
        setIsLoading(false);
        if (e.target) e.target.value = "";
    }
  };

  const handleAddPDF = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;
      setIsLoading(true);
      setLoadingMessage('Importing PDFs...');
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

  const handleDeleteSource = async (id: string) => {
    if (!window.confirm("Remove this folder and all its articles from the UI? (Real files on your disk will NOT be touched)")) return;
    setIsLoading(true);
    setLoadingMessage('Removing from view...');
    try {
      const allSourceIdsToDelete = new Set<string>();
      const collectIds = (sid: string) => {
          allSourceIdsToDelete.add(sid);
          sources.filter(s => s.parentId === sid).forEach(c => collectIds(c.id));
      };
      collectIds(id);

      const articlesToRemove = articles.filter(a => allSourceIdsToDelete.has(a.sourceId));
      const articleIdsToRemove = new Set(articlesToRemove.map(a => a.id));

      for (const aid of articleIdsToRemove) {
          await deleteArticleFromDB(aid);
          await deleteFileFromDB(aid);
      }
      for (const sid of allSourceIdsToDelete) {
          await deleteSourceFromDB(sid);
      }

      setSources(prev => prev.filter(s => !allSourceIdsToDelete.has(s.id)));
      setArticles(prev => prev.filter(a => !articleIdsToRemove.has(a.id)));
      setCheckedArticleIds(prev => {
          const next = new Set<string>(prev);
          articleIdsToRemove.forEach(aid => next.delete(aid));
          return next;
      });

      if (activeSourceId && allSourceIdsToDelete.has(activeSourceId)) setActiveSourceId(null);
      if (selectedArticleId && articleIdsToRemove.has(selectedArticleId)) setSelectedArticleId(null);

    } catch (err) {
      console.error("Failed to delete source", err);
    } finally {
        setIsLoading(false);
    }
  };

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
    const isSomethingChecked = checkedArticleIds.size > 0;
    const list = !isSomethingChecked ? articles : articles.filter(a => checkedArticleIds.has(a.id));
    
    if (options.references) {
      handleExportBibtex(list);
    }

    if (options.notes) {
      const ext = options.format || '.md';
      let content = '';
      const now = new Date().toLocaleString();

      if (ext === '.md') {
        content = `# Librarian Notes Export\nGenerated on ${now}\n\n`;
        
        if (options.notesOptions.general) {
          const gen = notes.filter(n => n.type === 'general');
          if (gen.length) {
            content += `## General Notes\n\n`;
            gen.forEach(n => content += `### ${n.title}\n${n.content}\n\n---\n\n`);
          }
        }

        if (options.notesOptions.category) {
          const cat = notes.filter(n => n.type === 'category');
          if (cat.length) {
            content += `## Category Notes\n\n`;
            cat.forEach(n => content += `### Category: ${n.targetId} - ${n.title}\n${n.content}\n\n---\n\n`);
          }
        }

        if (options.notesOptions.article && isSomethingChecked) {
          const artNotes = notes.filter(n => n.type === 'article' && checkedArticleIds.has(n.targetId!));
          if (artNotes.length) {
            content += `## Article Notes\n\n`;
            artNotes.forEach(n => {
              const art = articles.find(a => a.id === n.targetId);
              content += `### ${art?.metadata?.title || art?.fileName} - ${n.title}\n${n.content}\n\n---\n\n`;
            });
          }
        }
      } else if (ext === '.tex') {
        content = `% Librarian Notes Export\n% Generated on ${now}\n\n\\documentclass{article}\n\\usepackage[utf8]{inputenc}\n\\begin{document}\n\\title{Librarian Notes Export}\n\\maketitle\n\n`;
        
        if (options.notesOptions.general) {
          const gen = notes.filter(n => n.type === 'general');
          if (gen.length) {
            content += `\\section{General Notes}\n`;
            gen.forEach(n => content += `\\subsection{${n.title}}\n${n.content}\n\n`);
          }
        }

        if (options.notesOptions.category) {
          const cat = notes.filter(n => n.type === 'category');
          if (cat.length) {
            content += `\\section{Category Notes}\n`;
            cat.forEach(n => content += `\\subsection{Category: ${n.targetId} - ${n.title}}\n${n.content}\n\n`);
          }
        }

        if (options.notesOptions.article && isSomethingChecked) {
          const artNotes = notes.filter(n => n.type === 'article' && checkedArticleIds.has(n.targetId!));
          if (artNotes.length) {
            content += `\\section{Article Notes}\n`;
            artNotes.forEach(n => {
              const art = articles.find(a => a.id === n.targetId);
              content += `\\subsection{${art?.metadata?.title || art?.fileName} - ${n.title}}\n${n.content}\n\n`;
            });
          }
        }
        content += `\\end{document}`;
      }

      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `librarian_notes_${Date.now()}${ext}`;
      a.click();
      URL.revokeObjectURL(url);
    }
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
        a.metadata?.year.includes(q) ||
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
          case 'year': valA = parseInt(String(a.metadata?.year || '0'), 10); valB = parseInt(String(b.metadata?.year || '0'), 10); break;
        }
        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    } else list.sort((a, b) => b.addedAt - a.addedAt);
    return [...list];
  }, [articles, activeSourceId, activeCategoryId, searchQuery, sortConfig, sources]);

  const selectedArticle = useMemo(() => 
    articles.find(a => a.id === selectedArticleId), 
    [articles, selectedArticleId]
  );

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
        categories={categories}
        activeSourceId={activeSourceId}
        activeCategoryId={activeCategoryId}
        // Fix inferred "unknown" type errors by providing explicit callback parameter types.
        onSetActiveSource={(id: string | null) => { setActiveSourceId(id); setActiveCategoryId(null); }}
        onSetActiveCategory={(cat: string | null) => { setActiveCategoryId(cat); setActiveSourceId(null); }}
        onOpenAddModal={() => setIsAddSourceModalOpen(true)}
        onOpenGenerateModal={() => setIsGenerateModalOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenNote={(note: Note) => setSelectedNote(note)}
        onDeleteSource={handleDeleteSource}
        // Fix inferred "unknown" type error for targetArticles by providing explicit type.
        onExportMetadata={(targetArticles?: Article[]) => handleExportMetadata(targetArticles, 'metadata.json')}
        isGenerateDisabled={articles.length === 0}
      />

      <ArticleList 
        articles={filteredArticles}
        selectedArticleId={selectedArticleId}
        onSelectArticle={(id: string) => setSelectedArticleId(id)}
        checkedArticleIds={checkedArticleIds}
        onToggleArticle={(id: string) => setCheckedArticleIds(prev => {
            const next = new Set<string>(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        })}
        onToggleAll={(ids: string[]) => setCheckedArticleIds(new Set<string>(ids))}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSaveSession={() => {
            const blob = new Blob([JSON.stringify({ sources, articles, notes }, null, 2)], { type: 'application/json' });
            const url: string = URL.createObjectURL(blob);
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
                if (data.sources && data.articles) {
                  await restoreSession(data.sources, data.articles, data.notes || []);
                  setSources(data.sources); setArticles(data.articles); setNotes(data.notes || []);
                }
              } catch (err) { 
                const errorMsg = err instanceof Error ? err.message : String(err);
                alert(errorMsg || "Failed to import session."); 
              }
            };
            input.click();
        }}
        onDeleteSelected={async () => {
            if (checkedArticleIds.size === 0 || !window.confirm(`Delete ${checkedArticleIds.size} articles from UI?`)) return;
            for (const id of checkedArticleIds) {
                await deleteArticleFromDB(id);
                await deleteFileFromDB(id);
            }
            setArticles(prev => prev.filter(a => !checkedArticleIds.has(a.id)));
            setCheckedArticleIds(new Set<string>());
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
        onEditNote={(note) => { 
          setSelectedNote(null); 
          setIsEditingNote(!!note.id);
          setActiveEditorNote(note); 
        }}
        onOpenNote={setSelectedNote}
        onDeleteNote={(id) => { deleteNoteFromDB(id); setNotes(n => n.filter(x => x.id !== id)); if(selectedNote?.id === id) setSelectedNote(null); }}
        onReplacePdf={async (id, file) => {
            await saveFileToDB(id, file);
            setArticles(prev => prev.map(a => a.id === id ? { ...a, fileName: file.name, fileSize: file.size } : a));
        }}
      />

      <button onClick={() => {
          if (checkedArticleIds.size === 1) {
              const aid = Array.from(checkedArticleIds)[0];
              const art = articles.find(a => a.id === aid);
              setSelectedNote(null); 
              setIsEditingNote(false);
              setActiveEditorNote({ type: 'article', targetId: aid, content: '', title: `Notes on ${art?.metadata?.title || art?.fileName}` });
          } else setIsNotebookSetupOpen(true);
      }} className="fixed bottom-6 right-6 z-[40] p-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-lg transition-transform hover:scale-110 active:scale-95 flex items-center justify-center">
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
      </button>

      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} currentTheme={theme} onThemeChange={setTheme} />
      <NotebookModal isOpen={isNotebookSetupOpen} onClose={() => setIsNotebookSetupOpen(false)} articles={articles} categories={categories} onConfirm={(type, tid) => { setIsEditingNote(false); setActiveEditorNote({ type, targetId: tid, content: '', title: type === 'article' ? `Notes on ${articles.find(a => a.id === tid)?.metadata?.title || 'Article'}` : 'New Note' }); }} />
      <AddSourceModal isOpen={isAddSourceModalOpen} onClose={() => setIsAddSourceModalOpen(false)} onAddSource={handleAddSource} onAddPDF={handleAddPDF} />
      <GenerateModal isOpen={isGenerateModalOpen} onClose={() => setIsGenerateModalOpen(false)} onConfirm={handleGenerateConfirm} />
      {activeEditorNote && <NotebookEditor isOpen={!!activeEditorNote} initialData={activeEditorNote} onClose={() => setActiveEditorNote(null)} onSave={async (nd) => {
          let nn: Note;
          const isActuallyEditing = !!nd.id;
          
          if(isActuallyEditing) {
            const existing = notes.find(x => x.id === nd.id);
            nn = { ...existing!, ...nd } as Note;
          } else {
            nn = { 
              id: crypto.randomUUID(), 
              createdAt: Date.now(), 
              title: nd.title || 'Untitled', 
              content: nd.content || '', 
              type: nd.type as NoteType || 'general', 
              targetId: nd.targetId 
            };
          }
          
          await saveNoteToDB(nn);
          
          setNotes(prev => {
            const index = prev.findIndex(x => x.id === nn.id);
            if (index !== -1) {
              const next = [...prev];
              next[index] = nn;
              return next;
            }
            return [...prev, nn];
          });
      }} isEditing={isEditingNote} />}
      <NoteViewerModal note={selectedNote} onClose={() => setSelectedNote(null)} onUpdateTitle={(id, t) => {
          const note = notes.find(n => n.id === id);
          if (note) {
              const updated = { ...note, title: t };
              saveNoteToDB(updated);
              setNotes(prev => prev.map(x => x.id === id ? updated : x));
          }
      }} onDelete={(id) => { deleteNoteFromDB(id); setNotes(n => n.filter(x => x.id !== id)); setSelectedNote(null); }} onEdit={(n) => { setSelectedNote(null); setIsEditingNote(true); setActiveEditorNote(n); }} />
    </div>
  );
};

const App = () => (
  <Suspense fallback={<div className="h-screen w-screen flex items-center justify-center bg-slate-50 text-slate-500 italic">Initializing...</div>}><LibrarianApp /></Suspense>
);
createRoot(document.getElementById('root')!).render(<App />);