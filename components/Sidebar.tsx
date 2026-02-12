
import React, { useState } from 'react';
import { Source, Article, Note } from '../types';

interface SidebarProps {
  sources: Source[];
  articles: Article[];
  notes?: Note[];
  categories: string[];
  activeSourceId: string | null;
  activeCategoryId: string | null;
  onSetActiveSource: (id: string | null) => void;
  onSetActiveCategory: (cat: string | null) => void;
  onOpenAddModal: () => void;
  onOpenGenerateModal: () => void;
  onOpenSettings: () => void;
  onOpenNote: (note: Note) => void;
  onDeleteSource: (id: string) => void;
  isGenerateDisabled: boolean;
}

const SourceTreeItem: React.FC<{
  source: Source;
  allSources: Source[];
  articles: Article[];
  activeSourceId: string | null;
  depth: number;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}> = ({ source, allSources, articles, activeSourceId, depth, onSelect, onDelete }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const children = allSources.filter(s => s.parentId === source.id);
  const hasChildren = children.length > 0;
  const count = articles.filter(a => a.sourceId === source.id).length;

  return (
    <div>
      <div className={`w-full flex items-center justify-between group hover:bg-slate-800 transition-colors ${activeSourceId === source.id ? 'bg-slate-800 text-white' : 'text-slate-300'}`} style={{ paddingLeft: `${depth * 12 + 12}px` }}>
        <div className="flex items-center gap-1 flex-1 min-w-0 py-2 cursor-pointer" onClick={() => onSelect(source.id)}>
          <div onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }} className={`p-1 rounded hover:bg-slate-700 ${hasChildren ? 'visible' : 'invisible'}`}>
             <svg className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" strokeWidth={2} /></svg>
          </div>
          <svg className="w-4 h-4 shrink-0 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" strokeWidth={2} /></svg>
          <span className="truncate text-sm ml-1">{source.name}</span>
          <span className="text-[10px] bg-slate-700 px-1.5 py-0.5 rounded-full ml-auto mr-1">{count}</span>
        </div>
        <button onClick={(e) => { e.stopPropagation(); onDelete(source.id); }} className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-red-400 transition-opacity">
           <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeWidth={2} /></svg>
        </button>
      </div>
      {isExpanded && hasChildren && children.map(c => <SourceTreeItem key={c.id} source={c} allSources={allSources} articles={articles} activeSourceId={activeSourceId} depth={depth + 1} onSelect={onSelect} onDelete={onDelete} />)}
    </div>
  );
};

export const Sidebar: React.FC<SidebarProps> = ({
  sources, articles, notes = [], categories, activeSourceId, activeCategoryId, onSetActiveSource, onSetActiveCategory, onOpenAddModal, onOpenGenerateModal, onOpenSettings, onOpenNote, onDeleteSource, isGenerateDisabled
}) => {
  const rootSources = sources.filter(s => !s.parentId);
  return (
    <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col border-r border-slate-800 shrink-0">
      <div className="p-6 border-b border-slate-800">
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <svg className="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
          Librarian
        </h1>
      </div>
      <nav className="flex-1 overflow-y-auto py-4">
        <div className="px-6 mb-2 text-xs font-semibold uppercase text-slate-500">Library</div>
        <button onClick={() => onSetActiveSource(null)} className={`w-full text-left px-6 py-2 flex justify-between hover:bg-slate-800 ${!activeSourceId && !activeCategoryId ? 'bg-slate-800 text-white' : ''}`}>
           <span className="text-sm">All Articles</span>
           <span className="text-xs bg-slate-700 px-2 py-0.5 rounded-full">{articles.length}</span>
        </button>
        <div className="mt-4">{rootSources.map(s => <SourceTreeItem key={s.id} source={s} allSources={sources} articles={articles} activeSourceId={activeSourceId} depth={0} onSelect={onSetActiveSource} onDelete={onDeleteSource} />)}</div>
        {categories.length > 0 && (
          <div className="mt-6 border-t border-slate-800 pt-4">
            <div className="px-6 mb-2 text-xs font-semibold uppercase text-slate-500">Categories</div>
            {categories.map(cat => <button key={cat} onClick={() => onSetActiveCategory(activeCategoryId === cat ? null : cat)} className={`w-full text-left px-6 py-1.5 text-xs hover:bg-slate-800 ${activeCategoryId === cat ? 'bg-slate-800 text-white font-medium' : 'text-slate-400'}`}>{cat}</button>)}
          </div>
        )}
      </nav>
      <div className="p-4 border-t border-slate-800 space-y-2">
        <button onClick={onOpenAddModal} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 rounded-lg transition-colors flex items-center justify-center gap-2"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" strokeWidth={2} /></svg>Add</button>
        <button onClick={onOpenGenerateModal} disabled={isGenerateDisabled} className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-800 disabled:text-slate-600 text-white font-medium py-2 rounded-lg transition-colors flex items-center justify-center gap-2"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z" strokeWidth={2} /></svg>Generate</button>
        <button onClick={onOpenSettings} className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium py-2 rounded-lg transition-colors border border-slate-700 flex items-center justify-center gap-2"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" strokeWidth={2} /></svg>Settings</button>
      </div>
    </aside>
  );
};
