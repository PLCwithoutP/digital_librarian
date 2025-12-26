import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { Article, Source, ArticleMetadata } from './types';
import { getAllData, saveArticleToDB, saveFileToDB, saveSourceToDB, getFileFromDB, deleteSourceFromDB, deleteArticleFromDB, deleteFileFromDB, clearDatabase, restoreSession } from './db';
import { Sidebar } from './components/Sidebar';
import { ArticleList } from './components/ArticleList';
import { ArticleDetail } from './components/ArticleDetail';

const LibrarianApp = () => {
  const [sources, setSources] = useState<Source[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSourceId, setActiveSourceId] = useState<string | null>(null);
  const [isGrouped, setIsGrouped] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

  // Initialize fresh session on mount
  useEffect(() => {
    const initSession = async () => {
      try {
        // Clear persistent storage on startup to ensure a fresh session
        await clearDatabase();
        setSources([]);
        setArticles([]);
      } catch (err) {
        console.error("Failed to initialize session", err);
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
              if (data.pdfs && Array.isArray(data.pdfs)) {
                  data.pdfs.forEach((pdf: any) => {
                      if (pdf.file_name) {
                          pdfMetadataMap.set(pdf.file_name, pdf);
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
          // Extract keywords
          let keywords: string[] = [];
          if (meta.pdf_meta && meta.pdf_meta['/Keywords']) {
             keywords = meta.pdf_meta['/Keywords'].split(/[;,]/)
                .map((k: string) => k.trim())
                .filter((k: string) => k);
          } else if (Array.isArray(meta.keywords)) {
             keywords = meta.keywords;
          }

          // Extract categories (Subject)
          let categories: string[] = [];
          if (meta.pdf_meta && meta.pdf_meta['/Subject']) {
              const subj = meta.pdf_meta['/Subject'].trim();
              if (subj) categories.push(subj);
          }
          if (categories.length === 0 && meta.categories && Array.isArray(meta.categories)) {
              categories = meta.categories;
          }
          if (categories.length === 0) categories.push("Uncategorized");

          // Extract Year
          let year = "Unknown";
          if (meta.year) {
              year = String(meta.year);
          } else if (meta.pdf_meta && meta.pdf_meta['/CreationDate']) {
              const match = meta.pdf_meta['/CreationDate'].match(/D:(\d{4})/);
              if (match) year = match[1];
          }

          // Extract Authors
          let authors: string[] = [];
          if (Array.isArray(meta.authors)) {
              authors = meta.authors;
          } else if (meta.pdf_meta && meta.pdf_meta['/Author']) {
              authors = [meta.pdf_meta['/Author']];
          }
          if (authors.length === 0) authors = ["Unknown Author"];
          
          return {
              title: meta.title || meta.pdf_meta?.['/Title'] || file.name.replace(/\.pdf$/i, ''),
              authors: authors,
              year: year,
              abstract: meta.abstract || "",
              keywords: keywords,
              categories: categories
          };
      } else {
          return {
              title: file.name.replace(/\.pdf$/i, ''),
              authors: ["Unknown"],
              year: "Unknown",
              categories: ["Uncategorized"],
              keywords: [],
              abstract: ""
          };
      }
  };

  const handleAddSource = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // 1. Identify Source Name
    const firstFile = files[0] as any;
    const pathParts = firstFile.webkitRelativePath?.split('/') || [];
    const sourceName = pathParts.length > 1 ? pathParts[0] : `Source ${sources.length + 1}`;

    // 2. Check for collision and cleanup
    const existingSource = sources.find(s => s.name === sourceName);
    if (existingSource) {
      // Delete source from DB
      await deleteSourceFromDB(existingSource.id);
      
      // Delete articles and files from DB
      const articlesToDelete = articles.filter(a => a.sourceId === existingSource.id);
      await Promise.all(articlesToDelete.map(async (article) => {
        await deleteArticleFromDB(article.id);
        await deleteFileFromDB(article.id);
      }));

      // Update State (Remove old)
      setSources(prev => prev.filter(s => s.id !== existingSource.id));
      setArticles(prev => prev.filter(a => a.sourceId !== existingSource.id));

      // Reset selection if needed
      if (activeSourceId === existingSource.id) setActiveSourceId(null);
      if (selectedArticleId && articlesToDelete.find(a => a.id === selectedArticleId)) setSelectedArticleId(null);
    }

    const sourceId = crypto.randomUUID();
    const newSource: Source = { id: sourceId, name: sourceName };

    setSources(prev => [...prev, newSource]);
    await saveSourceToDB(newSource);

    const fileList: File[] = Array.from(files);
    const pdfMetadataMap = await processMetadataFiles(fileList);
    const newArticles: Article[] = [];
    
    for (const file of fileList) {
      if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) continue;

      const meta = pdfMetadataMap.get(file.name);
      const articleMetadata = createMetadata(file, meta);

      const articleId = crypto.randomUUID();
      const article: Article = {
        id: articleId,
        sourceId,
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
    if (e.target) e.target.value = ""; // Reset input
  };

  const handleAddPDF = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      // Find or create "Uploaded Files" source
      let uploadSource = sources.find(s => s.name === "Uploaded Files");
      let sourceId = uploadSource?.id;

      if (!uploadSource) {
          sourceId = crypto.randomUUID();
          uploadSource = { id: sourceId, name: "Uploaded Files" };
          setSources(prev => [...prev, uploadSource!]);
          await saveSourceToDB(uploadSource);
      } else {
          sourceId = uploadSource.id;
      }

      const fileList: File[] = Array.from(files);
      const pdfMetadataMap = await processMetadataFiles(fileList);
      const newArticles: Article[] = [];

      for (const file of fileList) {
          if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) continue;

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
      if (e.target) e.target.value = "";
  };

  const handleUpdateArticle = async (id: string, updates: Partial<ArticleMetadata>) => {
    const articleIndex = articles.findIndex(a => a.id === id);
    if (articleIndex === -1) return;

    const currentArticle = articles[articleIndex];
    const newMetadata = { ...currentArticle.metadata!, ...updates };
    const updatedArticle = { ...currentArticle, metadata: newMetadata };

    await saveArticleToDB(updatedArticle);
    setArticles(prev => {
      const newArr = [...prev];
      newArr[articleIndex] = updatedArticle;
      return newArr;
    });
  };

  const handleSaveSession = async () => {
    try {
      const { sources, articles } = await getAllData();
      const session = {
        timestamp: Date.now(),
        sources,
        articles
      };
      const blob = new Blob([JSON.stringify(session, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `librarian-session-${new Date().toISOString().slice(0,10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Save session failed", err);
      alert("Failed to save session.");
    }
  };

  const handleResetSession = async () => {
    if (window.confirm("Are you sure you want to reset the session? All imported data will be lost.")) {
      try {
        await clearDatabase();
        setSources([]);
        setArticles([]);
        setSelectedArticleId(null);
        setActiveSourceId(null);
        setSearchQuery('');
        setIsGrouped(false);
        setSortConfig(null);
      } catch (err) {
        console.error("Reset session failed", err);
        alert("Failed to reset session.");
      }
    }
  };

  const handleImportSession = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      if (!window.confirm("Importing a session will replace all current data. Continue?")) return;
      
      try {
        const text = await file.text();
        const session = JSON.parse(text);
        
        if (!Array.isArray(session.sources) || !Array.isArray(session.articles)) {
          alert("Invalid session file format. Missing sources or articles.");
          return;
        }

        // Reset first
        await clearDatabase();
        
        // Restore
        await restoreSession(session.sources, session.articles);
        setSources(session.sources);
        setArticles(session.articles);
        setSelectedArticleId(null);
        setActiveSourceId(null);
        setSearchQuery('');
        setIsGrouped(false);
        setSortConfig(null);
      } catch (err) {
        console.error("Import session failed", err);
        alert("Failed to import session. The file might be corrupted.");
      }
    };
    input.click();
  };

  const handleSort = (key: string) => {
    setSortConfig(current => {
      if (current?.key === key) {
        return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'asc' };
    });
  };

  const filteredArticles = useMemo(() => {
    let list = activeSourceId 
      ? articles.filter(a => a.sourceId === activeSourceId)
      : articles;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(a => {
        const m = a.metadata;
        return (
          a.fileName.toLowerCase().includes(q) ||
          m?.title.toLowerCase().includes(q) ||
          m?.authors.some(auth => auth.toLowerCase().includes(q)) ||
          m?.year.includes(q) ||
          m?.keywords.some(k => k.toLowerCase().includes(q)) ||
          m?.categories.some(c => c.toLowerCase().includes(q))
        );
      });
    }

    if (sortConfig) {
      list.sort((a, b) => {
        let valA: string | number = '';
        let valB: string | number = '';

        switch(sortConfig.key) {
          case 'publication':
            valA = (a.metadata?.title || a.fileName).toLowerCase();
            valB = (b.metadata?.title || b.fileName).toLowerCase();
            break;
          case 'authors':
            valA = (a.metadata?.authors?.[0] || '').toLowerCase();
            valB = (b.metadata?.authors?.[0] || '').toLowerCase();
            break;
          case 'year':
            const yearA = parseInt(a.metadata?.year || '0', 10);
            const yearB = parseInt(b.metadata?.year || '0', 10);
            valA = isNaN(yearA) ? 0 : yearA;
            valB = isNaN(yearB) ? 0 : yearB;
            break;
        }

        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    } else {
        // Default sort by addedAt desc
        list.sort((a, b) => b.addedAt - a.addedAt);
    }

    return [...list]; // Return new array reference
  }, [articles, activeSourceId, searchQuery, sortConfig]);

  const selectedArticle = articles.find(a => a.id === selectedArticleId);

  return (
    <div className="flex h-screen w-screen bg-slate-50 font-sans text-slate-900 overflow-hidden">
      <Sidebar 
        sources={sources}
        articles={articles}
        activeSourceId={activeSourceId}
        onSetActiveSource={setActiveSourceId}
        onAddSource={handleAddSource}
        onAddPDF={handleAddPDF}
      />

      <ArticleList 
        articles={filteredArticles}
        selectedArticleId={selectedArticleId}
        onSelectArticle={setSelectedArticleId}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSaveSession={handleSaveSession}
        onImportSession={handleImportSession}
        onResetSession={handleResetSession}
        isGrouped={isGrouped}
        onToggleGroup={() => setIsGrouped(prev => !prev)}
        sortConfig={sortConfig}
        onSort={handleSort}
      />

      <ArticleDetail 
        article={selectedArticle}
        onClose={() => setSelectedArticleId(null)}
        onUpdateMetadata={handleUpdateArticle}
      />

      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        
        body {
          margin: 0;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        }

        /* Custom Scrollbar */
        ::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        ::-webkit-scrollbar-track {
          background: #f1f1f1;
        }
        ::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 10px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
      `}} />
    </div>
  );
};

const App = () => (
  <Suspense fallback={<div className="h-screen w-screen flex items-center justify-center bg-slate-50 text-slate-500 italic">Initializing Librarian...</div>}>
    <LibrarianApp />
  </Suspense>
);

const root = createRoot(document.getElementById('root')!);
root.render(<App />);