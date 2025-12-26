
import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { Article, Source } from './types';
import { getAllData, saveArticleToDB, saveFileToDB, saveSourceToDB, getFileFromDB } from './db';
import { Sidebar } from './components/Sidebar';
import { ArticleList } from './components/ArticleList';
import { ArticleDetail } from './components/ArticleDetail';

const LibrarianApp = () => {
  const [sources, setSources] = useState<Source[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSourceId, setActiveSourceId] = useState<string | null>(null);

  // Load data on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const { sources, articles } = await getAllData();
        setSources(sources);
        setArticles(articles);
      } catch (err) {
        console.error("Failed to load data from IndexedDB", err);
      }
    };
    loadData();
  }, []);

  const handleAddSource = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const sourceId = crypto.randomUUID();
    const firstFile = files[0] as any;
    const sourceName = firstFile.webkitRelativePath?.split('/')[0] || `Source ${sources.length + 1}`;
    const newSource: Source = { id: sourceId, name: sourceName };

    setSources(prev => [...prev, newSource]);
    await saveSourceToDB(newSource);

    const newArticles: Article[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) continue;

      const articleId = crypto.randomUUID();
      const article: Article = {
        id: articleId,
        sourceId,
        fileName: file.name,
        fileSize: file.size,
        addedAt: Date.now(),
        status: 'completed' // Marked as completed immediately, metadata will be empty for now
      };
      
      newArticles.push(article);
      await saveFileToDB(articleId, file);
      await saveArticleToDB(article);
    }

    setArticles(prev => [...prev, ...newArticles]);
    if (e.target) e.target.value = ""; // Reset input
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

    return list.sort((a, b) => b.addedAt - a.addedAt);
  }, [articles, activeSourceId, searchQuery]);

  const selectedArticle = articles.find(a => a.id === selectedArticleId);

  return (
    <div className="flex h-screen w-screen bg-slate-50 font-sans text-slate-900 overflow-hidden">
      <Sidebar 
        sources={sources}
        articles={articles}
        activeSourceId={activeSourceId}
        onSetActiveSource={setActiveSourceId}
        onAddSource={handleAddSource}
      />

      <ArticleList 
        articles={filteredArticles}
        selectedArticleId={selectedArticleId}
        onSelectArticle={setSelectedArticleId}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      <ArticleDetail 
        article={selectedArticle}
        onClose={() => setSelectedArticleId(null)}
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
