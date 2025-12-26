
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI, Type } from "@google/genai";
import * as pdfjsLib from 'pdfjs-dist';

// Initialize PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

// Types
interface ArticleMetadata {
  title: string;
  authors: string[];
  year: string;
  categories: string[];
  keywords: string[];
  abstract: string;
}

interface Article {
  id: string;
  sourceId: string;
  fileName: string;
  fileSize: number;
  addedAt: number;
  metadata?: ArticleMetadata;
  status: 'pending' | 'processing' | 'completed' | 'error';
}

interface Source {
  id: string;
  name: string;
  path?: string;
}

// Database Helper (Simple IndexedDB wrapper for persistence)
const DB_NAME = 'LibrarianDB';
const DB_VERSION = 1;

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('articles')) {
        db.createObjectStore('articles', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('sources')) {
        db.createObjectStore('sources', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('files')) {
        db.createObjectStore('files', { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

const App = () => {
  const [sources, setSources] = useState<Source[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeSourceId, setActiveSourceId] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Set non-standard attributes manually to avoid React Error #299
  useEffect(() => {
    if (fileInputRef.current) {
      fileInputRef.current.setAttribute("webkitdirectory", "");
      fileInputRef.current.setAttribute("directory", "");
    }
  }, []);

  // Load data on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const db = await openDB();
        const sourcesTx = db.transaction('sources', 'readonly');
        const articlesTx = db.transaction('articles', 'readonly');
        
        const sourcesStore = sourcesTx.objectStore('sources');
        const articlesStore = articlesTx.objectStore('articles');

        const loadedSources: Source[] = await new Promise((res) => {
          const req = sourcesStore.getAll();
          req.onsuccess = () => res(req.result);
        });

        const loadedArticles: Article[] = await new Promise((res) => {
          const req = articlesStore.getAll();
          req.onsuccess = () => res(req.result);
        });

        setSources(loadedSources);
        setArticles(loadedArticles);
      } catch (err) {
        console.error("Failed to load data from IndexedDB", err);
      }
    };
    loadData();
  }, []);

  const saveArticleToDB = async (article: Article) => {
    const db = await openDB();
    const tx = db.transaction('articles', 'readwrite');
    tx.objectStore('articles').put(article);
  };

  const saveSourceToDB = async (source: Source) => {
    const db = await openDB();
    const tx = db.transaction('sources', 'readwrite');
    tx.objectStore('sources').put(source);
  };

  const saveFileToDB = async (id: string, blob: Blob) => {
    const db = await openDB();
    const tx = db.transaction('files', 'readwrite');
    tx.objectStore('files').put({ id, blob });
  };

  const getFileFromDB = async (id: string): Promise<Blob | null> => {
    const db = await openDB();
    const tx = db.transaction('files', 'readonly');
    return new Promise((res) => {
      const req = tx.objectStore('files').get(id);
      req.onsuccess = () => res(req.result?.blob || null);
    });
  };

  const extractTextFromPDF = async (file: File | Blob): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';
    const pagesToRead = Math.min(pdf.numPages, 5);
    for (let i = 1; i <= pagesToRead; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(' ');
      fullText += pageText + '\n';
    }
    return fullText;
  };

  const processArticleMetadata = async (article: Article, pdfText: string) => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
    
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Extract scholarly metadata from the following PDF text excerpt. 
        If an abstract is explicitly found, use it. Otherwise, summarize the first 3 paragraphs as the abstract.
        Text: ${pdfText.substring(0, 8000)}`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              authors: { type: Type.ARRAY, items: { type: Type.STRING } },
              year: { type: Type.STRING },
              categories: { type: Type.ARRAY, items: { type: Type.STRING } },
              keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
              abstract: { type: Type.STRING },
            },
            required: ["title", "authors", "year", "categories", "keywords", "abstract"]
          }
        }
      });

      const metadata: ArticleMetadata = JSON.parse(response.text || '{}');
      const updatedArticle: Article = { ...article, metadata, status: 'completed' };
      
      setArticles(prev => prev.map(a => a.id === article.id ? updatedArticle : a));
      saveArticleToDB(updatedArticle);
    } catch (err) {
      console.error("AI processing failed", err);
      const errorArticle: Article = { ...article, status: 'error' };
      setArticles(prev => prev.map(a => a.id === article.id ? errorArticle : a));
      saveArticleToDB(errorArticle);
    }
  };

  const handleAddSource = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsProcessing(true);
    const sourceId = crypto.randomUUID();
    const sourceName = files[0].webkitRelativePath.split('/')[0] || `Source ${sources.length + 1}`;
    const newSource: Source = { id: sourceId, name: sourceName };

    setSources(prev => [...prev, newSource]);
    await saveSourceToDB(newSource);

    const newArticles: Article[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.type !== 'application/pdf') continue;

      const articleId = crypto.randomUUID();
      const article: Article = {
        id: articleId,
        sourceId,
        fileName: file.name,
        fileSize: file.size,
        addedAt: Date.now(),
        status: 'pending'
      };
      
      newArticles.push(article);
      await saveFileToDB(articleId, file);
      await saveArticleToDB(article);
    }

    setArticles(prev => [...prev, ...newArticles]);

    // Process metadata in sequence or chunks to avoid overwhelming memory/network
    for (const article of newArticles) {
      const blob = await getFileFromDB(article.id);
      if (blob) {
        setArticles(prev => prev.map(a => a.id === article.id ? { ...a, status: 'processing' } : a));
        try {
          const text = await extractTextFromPDF(blob);
          await processArticleMetadata(article, text);
        } catch (e) {
          console.error(`Failed to process ${article.fileName}`, e);
          const errorArticle: Article = { ...article, status: 'error' };
          setArticles(prev => prev.map(a => a.id === article.id ? errorArticle : a));
        }
      }
    }

    setIsProcessing(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
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
      {/* Sidebar - Sources */}
      <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col border-r border-slate-800 shrink-0">
        <div className="p-6 border-b border-slate-800">
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <svg className="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            Librarian
          </h1>
        </div>

        <nav className="flex-1 overflow-y-auto py-4">
          <div className="px-6 mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Sources
          </div>
          <button 
            onClick={() => setActiveSourceId(null)}
            className={`w-full text-left px-6 py-2 flex items-center justify-between hover:bg-slate-800 transition-colors ${!activeSourceId ? 'bg-slate-800 text-white' : ''}`}
          >
            <span>All Articles</span>
            <span className="text-xs bg-slate-700 px-2 py-0.5 rounded-full">{articles.length}</span>
          </button>
          
          {sources.map(source => (
            <button 
              key={source.id}
              onClick={() => setActiveSourceId(source.id)}
              className={`w-full text-left px-6 py-2 flex items-center justify-between hover:bg-slate-800 transition-colors ${activeSourceId === source.id ? 'bg-slate-800 text-white' : ''}`}
            >
              <span className="truncate">{source.name}</span>
              <span className="text-xs bg-slate-700 px-2 py-0.5 rounded-full">
                {articles.filter(a => a.sourceId === source.id).length}
              </span>
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <label className="flex items-center justify-center gap-2 w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 rounded-lg cursor-pointer transition-colors shadow-lg">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Folder
            <input 
              ref={fileInputRef}
              type="file" 
              className="hidden" 
              onChange={handleAddSource}
            />
          </label>
          {isProcessing && (
            <div className="mt-3 flex items-center gap-2 text-xs text-indigo-400">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Processing PDFs...
            </div>
          )}
        </div>
      </aside>

      {/* Main Content - Article List */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-slate-200 p-4 flex items-center justify-between shadow-sm z-10">
          <div className="relative w-full max-w-xl">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            <input 
              type="text" 
              placeholder="Search by title, author, year, category..."
              className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="text-sm text-slate-500 ml-4 font-medium whitespace-nowrap">
            {filteredArticles.length} {filteredArticles.length === 1 ? 'article' : 'articles'} found
          </div>
        </header>

        <div className="flex-1 overflow-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-1/2">Article</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Authors</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Year</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              {filteredArticles.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-20 text-center text-slate-400 italic">
                    No articles found in this view.
                  </td>
                </tr>
              ) : (
                filteredArticles.map((article) => (
                  <tr 
                    key={article.id} 
                    onClick={() => setSelectedArticleId(article.id)}
                    className={`hover:bg-indigo-50 cursor-pointer transition-colors ${selectedArticleId === article.id ? 'bg-indigo-50 border-l-4 border-l-indigo-500' : ''}`}
                  >
                    <td className="px-6 py-4">
                      <div className="text-sm font-semibold text-slate-900 line-clamp-2">
                        {article.metadata?.title || article.fileName}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        {(article.fileSize / 1024 / 1024).toFixed(2)} MB • {new Date(article.addedAt).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-slate-600 line-clamp-1">
                        {article.metadata?.authors.join(', ') || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-slate-600">
                        {article.metadata?.year || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        article.status === 'completed' ? 'bg-green-100 text-green-800' :
                        article.status === 'processing' ? 'bg-blue-100 text-blue-800 animate-pulse' :
                        article.status === 'error' ? 'bg-red-100 text-red-800' :
                        'bg-slate-100 text-slate-800'
                      }`}>
                        {article.status.charAt(0).toUpperCase() + article.status.slice(1)}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </main>

      {/* Side Detail Panel */}
      <div className={`fixed inset-y-0 right-0 w-[450px] bg-white shadow-2xl transform transition-transform duration-300 ease-in-out border-l border-slate-200 flex flex-col z-20 ${selectedArticle ? 'translate-x-0' : 'translate-x-full'}`}>
        {selectedArticle && (
          <>
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">Article Summary</h2>
              <button 
                onClick={() => setSelectedArticleId(null)}
                className="text-slate-400 hover:text-slate-600 transition-colors p-1"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-8">
              {selectedArticle.status === 'pending' || selectedArticle.status === 'processing' ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 text-center">
                  <svg className="w-12 h-12 mb-4 animate-spin text-indigo-400" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <p>Wait while we analyze this article...</p>
                </div>
              ) : selectedArticle.status === 'error' ? (
                <div className="flex flex-col items-center justify-center h-full text-red-400 text-center p-4">
                   <svg className="w-12 h-12 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <p>There was an error parsing this metadata. The PDF might be restricted or corrupt.</p>
                </div>
              ) : (
                <div className="space-y-8">
                  <header>
                    <h3 className="text-2xl font-serif font-bold leading-tight text-slate-900 mb-4">
                      {selectedArticle.metadata?.title}
                    </h3>
                    <div className="space-y-2">
                      <div className="flex gap-2 text-sm">
                        <span className="font-semibold text-slate-500 w-16">Authors:</span>
                        <span className="text-slate-700 flex-1">{selectedArticle.metadata?.authors.join(', ')}</span>
                      </div>
                      <div className="flex gap-2 text-sm">
                        <span className="font-semibold text-slate-500 w-16">Year:</span>
                        <span className="text-slate-700">{selectedArticle.metadata?.year}</span>
                      </div>
                    </div>
                  </header>

                  <section>
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Categories & Keywords</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedArticle.metadata?.categories.map(cat => (
                        <span key={cat} className="px-2.5 py-1 bg-indigo-50 text-indigo-700 text-xs font-semibold rounded-md border border-indigo-100">
                          {cat}
                        </span>
                      ))}
                      {selectedArticle.metadata?.keywords.map(kw => (
                        <span key={kw} className="px-2.5 py-1 bg-slate-100 text-slate-600 text-xs font-medium rounded-md border border-slate-200">
                          {kw}
                        </span>
                      ))}
                    </div>
                  </section>

                  <section className="bg-slate-50 p-6 rounded-xl border border-slate-100">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Abstract / Summary</h4>
                    <p className="text-slate-700 leading-relaxed font-serif text-lg">
                      {selectedArticle.metadata?.abstract}
                    </p>
                  </section>
                  
                  <div className="pt-8 border-t border-slate-100">
                    <button 
                      onClick={async () => {
                        const blob = await getFileFromDB(selectedArticle.id);
                        if (blob) {
                          const url = URL.createObjectURL(blob);
                          window.open(url, '_blank');
                        }
                      }}
                      className="w-full py-3 bg-slate-900 text-white font-bold rounded-lg hover:bg-slate-800 transition-all shadow-md flex items-center justify-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                      Open PDF File
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <style>{`
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
      `}</style>
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
