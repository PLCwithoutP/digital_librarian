import React from 'react';
import { Source, Article } from '../types';

interface SidebarProps {
  sources: Source[];
  articles: Article[];
  activeSourceId: string | null;
  onSetActiveSource: (id: string | null) => void;
  onAddSource: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onAddPDF: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  sources,
  articles,
  activeSourceId,
  onSetActiveSource,
  onAddSource,
  onAddPDF,
}) => {
  return (
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
          onClick={() => onSetActiveSource(null)}
          className={`w-full text-left px-6 py-2 flex items-center justify-between hover:bg-slate-800 transition-colors ${!activeSourceId ? 'bg-slate-800 text-white' : ''}`}
        >
          <span>All Articles</span>
          <span className="text-xs bg-slate-700 px-2 py-0.5 rounded-full">{articles.length}</span>
        </button>
        
        {sources.map(source => (
          <button 
            key={source.id}
            onClick={() => onSetActiveSource(source.id)}
            className={`w-full text-left px-6 py-2 flex items-center justify-between hover:bg-slate-800 transition-colors ${activeSourceId === source.id ? 'bg-slate-800 text-white' : ''}`}
          >
            <span className="truncate">{source.name}</span>
            <span className="text-xs bg-slate-700 px-2 py-0.5 rounded-full">
              {articles.filter(a => a.sourceId === source.id).length}
            </span>
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-800 space-y-3">
        <label className="flex items-center justify-center gap-2 w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 rounded-lg cursor-pointer transition-colors shadow-lg">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Folder
          <input 
            type="file" 
            className="hidden" 
            onChange={onAddSource}
            multiple
            // @ts-ignore
            webkitdirectory=""
            directory=""
          />
        </label>

        <label className="flex items-center justify-center gap-2 w-full bg-slate-700 hover:bg-slate-600 text-white font-medium py-2 rounded-lg cursor-pointer transition-colors shadow-lg">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
          Add PDF
          <input 
            type="file" 
            className="hidden" 
            onChange={onAddPDF}
            accept=".pdf,.json"
            multiple
          />
        </label>
      </div>
    </aside>
  );
};