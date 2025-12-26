
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
  sortConfig: { key: string; direction: 'asc' | 'desc' } | null;
  onSort: (key: string) => void;
}

const getCategoryStyle = (category: string) => {
  if (category === 'Uncategorized') return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700';
  
  const styles = [
    'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300 border-red-100 dark:border-red-900/50',
    'bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 border-orange-100 dark:border-orange-900/50',
    'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-amber-100 dark:border-amber-900/50',
    'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300 border-green-100 dark:border-green-900/50',
    'bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300 border-teal-100 dark:border-teal-900/50',
    'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-blue-100 dark:border-blue-900/50',
    'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 border-indigo-100 dark:border-indigo-900/50',
    'bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300 border-violet-100 dark:border-violet-900/50',
    'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 border-purple-100 dark:border-purple-900/50',
    'bg-pink-50 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300 border-pink-100 dark:border-pink-900/50',
    'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300 border-rose-100 dark:border-rose-900/50',
  ];
  
  let hash = 0;
  for (let i = 0; i < category.length; i++) {
    hash = category.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % styles.length;
  return styles[index];
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
  onToggleGroup,
  sortConfig,
  onSort
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
     return (
      <tr 
        key={article.id} 
        onClick={() => onSelectArticle(article.id)}
        className={`hover:bg-indigo-50 dark:hover:bg-slate-800 cursor-pointer transition-colors border-b border-slate-100 dark:border-slate-800 last:border-0 ${selectedArticleId === article.id ? 'bg-indigo-50 dark:bg-slate-800 border-l-4 border-l-indigo-500' : 'bg-white dark:bg-slate-900'}`}
      >
        <td className="px-6 py-4">
          <div className="flex flex-col gap-1.5">
            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 line-clamp-2">
              {article.metadata?.title || article.fileName}
            </div>
            
            <div className="flex flex-wrap gap-1">
                {article.metadata?.categories?.length ? article.metadata.categories.map(cat => (
                  <span key={cat} className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${getCategoryStyle(cat)}`}>
                    {cat}
                  </span>
                )) : (
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${getCategoryStyle('Uncategorized')}`}>
                    Uncategorized
                  </span>
                )}
            </div>

            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {(article.fileSize / 1024 / 1024).toFixed(2)} MB • {new Date(article.addedAt).toLocaleDateString()}
            </div>
          </div>
        </td>
        <td className="px-6 py-4">
          <div className="text-sm text-slate-600 dark:text-slate-300 line-clamp-2">
            {article.metadata?.authors.join(', ') || '-'}
          </div>
        </td>
        <td className="px-6 py-4">
          <div className="text-sm text-slate-600 dark:text-slate-300">
            {article.metadata?.year || '-'}
          </div>
        </td>
      </tr>
     );
  };

  const renderSortArrow = (key: string) => {
      if (sortConfig?.key !== key) return <span className="text-slate-300 dark:text-slate-600 opacity-0 group-hover:opacity-50 ml-1 transition-opacity">↕</span>;
      return <span className="text-indigo-600 dark:text-indigo-400 ml-1">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>;
  };

  return (
    <main className="flex-1 flex flex-col min-w-0 bg-slate-50 dark:bg-slate-950">
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 p-4 flex items-center justify-between shadow-sm z-10 gap-4">
        <div className="relative w-full max-w-lg">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </span>
          <input 
            type="text" 
            placeholder="Search by title, author, year, category, keywords..."
            className="block w-full pl-10 pr-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2">
          <button
             onClick={onToggleGroup}
             className={`px-3 py-2 text-sm font-medium border rounded-lg flex items-center gap-2 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${
                 isGrouped 
                 ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800' 
                 : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
             }`}
             title="Group by Categories"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            <span className="hidden lg:inline">{isGrouped ? 'Ungroup' : 'Group by Label'}</span>
          </button>

          <div className="h-6 w-px bg-slate-300 dark:bg-slate-700 mx-1"></div>

          <button 
            onClick={onSaveSession}
            className="px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 flex items-center gap-2 transition-colors"
            title="Save Session"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
            </svg>
            <span className="hidden lg:inline">Save</span>
          </button>
          
          <button 
            onClick={onImportSession}
            className="px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 flex items-center gap-2 transition-colors"
            title="Import Session"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            <span className="hidden lg:inline">Import</span>
          </button>
          
          <button 
            onClick={onResetSession}
            className="px-3 py-2 text-sm font-medium text-red-600 dark:text-red-400 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 flex items-center gap-2 transition-colors"
            title="Delete All Articles"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            <span className="hidden lg:inline">Delete</span>
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-auto bg-slate-50 dark:bg-slate-950">
        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
          <thead className="bg-slate-50 dark:bg-slate-900 sticky top-0 z-10 shadow-sm">
            <tr>
              <th 
                className="px-6 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-1/2 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 group select-none"
                onClick={() => onSort('publication')}
              >
                Publication {renderSortArrow('publication')}
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 group select-none"
                onClick={() => onSort('authors')}
              >
                Authors {renderSortArrow('authors')}
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 group select-none"
                onClick={() => onSort('year')}
              >
                Year {renderSortArrow('year')}
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800">
            {articles.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-6 py-20 text-center text-slate-400 dark:text-slate-500 italic">
                  No articles found.
                </td>
              </tr>
            ) : isGrouped && groupedArticles ? (
                groupedArticles.map(([category, groupArticles]) => (
                    <React.Fragment key={category}>
                        <tr className="bg-slate-100 dark:bg-slate-800">
                            <td colSpan={3} className="px-6 py-2 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
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
