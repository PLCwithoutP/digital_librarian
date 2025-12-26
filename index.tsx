import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { Article, Source, ArticleMetadata } from './types';
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
    const pathParts = firstFile.webkitRelativePath?.split('/') || [];
    const sourceName = pathParts.length > 1 ? pathParts[0] : `Source ${sources.length + 1}`;
    
    const newSource: Source = { id: sourceId, name: sourceName };

    setSources(prev => [...prev, newSource]);
    await saveSourceToDB(newSource);

    // 1. Process Metadata JSON files first
    const fileList: File[] = Array.from(files);
    const jsonFiles = fileList.filter(f => f.name.toLowerCase().endsWith('.json'));
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

    const newArticles: Article[] = [];
    
    for (const file of fileList) {
      if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) continue;

      const meta = pdfMetadataMap.get(file.name);
      let articleMetadata: ArticleMetadata | undefined = undefined;

      if (meta) {
          // Extract keywords
          let keywords: string[] = [];
          if (meta.pdf_meta && meta.pdf_meta['/Keywords']) {
             // Keywords in PDF metadata are often separated by ; or ,
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
              // Heuristic: if subject is reasonably short, treat as category. 
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
              // Format D:YYYYMMDD...
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

          articleMetadata = {
              title: meta.title || meta.pdf_meta?.['/Title'] || file.name.replace('.pdf', ''),
              authors: authors,
              year: year,
              abstract: meta.abstract || "",
              keywords: keywords,
              categories: categories
          };
      }

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