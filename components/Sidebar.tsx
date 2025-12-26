
import React from 'react';
import { Source, Article, Note } from '../types';

interface SidebarProps {
  sources: Source[];
  articles: Article[];
  notes?: Note[];
  activeSourceId: string | null;
  onSetActiveSource: (id: string | null) => void;
  onOpenAddModal: () => void;
  onOpenGenerateModal: () => void;
  onOpenSettings: () => void;
  onOpenNote: (note: Note) => void;
  isGenerateDisabled: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  sources,
  articles,
  notes = [],
  activeSourceId,
  onSetActiveSource,
  onOpenAddModal,
  onOpenGenerateModal,
  onOpenSettings,
  onOpenNote,
  isGenerateDisabled
}) => {
  // Filter notes that should appear in Sidebar (General and Category)
  const sidebarNotes = notes.filter(n => n.type !== 'article');

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

      <nav className="flex-1 overflow-y-auto py-4 scrollbar-thin scrollbar-thumb-slate-700">
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

        {sidebarNotes.length > 0 && (
          <>
            <div className="px-6 mt-6 mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500 border-t border-slate-800 pt-4">
              Notes
            </div>
            {sidebarNotes.map(note => (
              <button 
                key={note.id}
                onClick={() => onOpenNote(note)}
                className="w-full text-left px-6 py-2 flex items-center gap-3 hover:bg-slate-800 transition-colors group"
              >
                <svg className={`w-4 h-4 shrink-0 ${note.type === 'category' ? 'text-purple-400' : 'text-slate-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {note.type === 'category' 
                    ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                    : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  }
                </svg>
                <span className="truncate text-sm">{note.title}</span>
              </button>
            ))}
          </>
        )}
      </nav>

      <div className="p-4 border-t border-slate-800 space-y-3">
        
        <button 
          onClick={onOpenAddModal}
          className="flex items-center justify-center gap-2 w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 rounded-lg cursor-pointer transition-colors shadow-lg"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add
        </button>

        <button 
          onClick={onOpenGenerateModal}
          disabled={isGenerateDisabled}
          className={`flex items-center justify-center gap-2 w-full font-medium py-2 rounded-lg cursor-pointer transition-colors shadow-lg ${
              isGenerateDisabled 
              ? 'bg-slate-800 text-slate-600 cursor-not-allowed' 
              : 'bg-emerald-600 hover:bg-emerald-700 text-white'
          }`}
          title={isGenerateDisabled ? "Select articles to generate output" : "Generate output"}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          Generate
        </button>

        <div className="grid grid-cols-1 gap-2 pt-2 border-t border-slate-700/50">
            <button 
              onClick={onOpenSettings}
              className="flex items-center justify-center gap-2 w-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-medium py-2 rounded-lg transition-colors border border-slate-700"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Settings
            </button>
        </div>
      </div>
    </aside>
  );
};
