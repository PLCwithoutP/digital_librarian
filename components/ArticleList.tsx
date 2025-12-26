
import React, { useMemo } from 'react';
import { Article } from '../types';

interface ArticleListProps {
  articles: Article[];
  selectedArticleId: string | null;
  onSelectArticle: (id: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSaveSession: () => void;
  onImportSession: () => void;
  onResetSession: () => void;
  isGrouped: boolean;
  onToggleGroup: () => void;
}

const getTypeColor = (type: string | undefined) => {
  const t = (type || '').toLowerCase();
  if (t.includes('article')) return 'bg-blue-100 text-blue-800';
  if (t.includes('report')) return 'bg-purple-100 text-purple-800';
  if (t.includes('conf') || t.includes('proceeding')) return 'bg-orange-100 text-orange-800';
  if (t.includes('book')) return 'bg-green-100 text-green-800';
  return 'bg-slate-100 text-slate-800';
};

export const ArticleList: React.FC<ArticleListProps> = ({
  articles,
  selectedArticleId,
  onSelectArticle,
  searchQuery,
  onSearchChange,
  onSaveSession,
  onImportSession,
  onResetSession,
  isGrouped,
  onToggleGroup
}) => {

  const groupedArticles = useMemo(() => {
    if (!isGrouped) return null;
    
    const groups: Record<string, Article[]> = {};
    
    articles.forEach(article => {
      const categories = article.metadata?.categories?.length 
        ? article.metadata.categories 
        : ['Uncategorized'];
        
      categories.forEach(cat => {
        if (!groups[cat]) groups[cat] = [];
        groups[cat].push(article);
      });
    });

    return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
  }, [articles, isGrouped]);

  const renderRow = (article: Article) => {
     const type = article.metadata?.type || 'Non-Deducted';
     return (
      <tr 
        key={article.id} 
        onClick={() => onSelectArticle(article.id)}
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
          <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getTypeColor(type)}`}>
            {type}
          </span>
        </td>
      </tr>
     );
  };

  return (
    <main className="flex-1 flex flex-col min-w-0">
      <header className="bg-white border-b border-slate-200 p-4 flex items-center justify-between shadow-sm z-10 gap-4">
        <div className="relative w-full max-w-lg">
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
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2">
          <button
             onClick={onToggleGroup}
             className={`px-3 py-2 text-sm font-medium border rounded-lg flex items-center gap-2 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${
                 isGrouped 
                 ? 'bg-indigo-50 text-indigo-700 border-indigo-200' 
                 : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
             }`}
             title="Group by Categories"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            <span className="hidden lg:inline">{isGrouped ? 'Ungroup' : 'Group by Label'}</span>
          </button>

          <div className="h-6 w-px bg-slate-300 mx-1"></div>

          <button 
            onClick={onSaveSession}
            className="px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 flex items-center gap-2 transition-colors"
            title="Save Session"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
            </svg>
            <span className="hidden lg:inline">Save</span>
          </button>
          
          <button 
            onClick={onImportSession}
            className="px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 flex items-center gap-2 transition-colors"
            title="Import Session"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            <span className="hidden lg:inline">Import</span>
          </button>
          
          <button 
            onClick={onResetSession}
            className="px-3 py-2 text-sm font-medium text-red-600 bg-white border border-slate-300 rounded-lg hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 flex items-center gap-2 transition-colors"
            title="Reset Session"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            <span className="hidden lg:inline">Reset</span>
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-1/2">Publication</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Authors</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Year</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Type</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-100">
            {articles.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-20 text-center text-slate-400 italic">
                  No articles found.
                </td>
              </tr>
            ) : isGrouped && groupedArticles ? (
                groupedArticles.map(([category, groupArticles]) => (
                    <React.Fragment key={category}>
                        <tr className="bg-slate-100">
                            <td colSpan={4} className="px-6 py-2 text-xs font-bold uppercase tracking-wider text-slate-600">
                                {category} ({groupArticles.length})
                            </td>
                        </tr>
                        {groupArticles.map(renderRow)}
                    </React.Fragment>
                ))
            ) : (
              articles.map(renderRow)
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
};
