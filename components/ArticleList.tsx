
import React from 'react';
import { Article } from '../types';

interface ArticleListProps {
  articles: Article[];
  selectedArticleId: string | null;
  onSelectArticle: (id: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export const ArticleList: React.FC<ArticleListProps> = ({
  articles,
  selectedArticleId,
  onSelectArticle,
  searchQuery,
  onSearchChange
}) => {
  return (
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
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
        <div className="text-sm text-slate-500 ml-4 font-medium whitespace-nowrap">
          {articles.length} {articles.length === 1 ? 'article' : 'articles'} found
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
            {articles.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-20 text-center text-slate-400 italic">
                  No articles found in this view.
                </td>
              </tr>
            ) : (
              articles.map((article) => (
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
  );
};
