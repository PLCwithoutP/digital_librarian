
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
  onRefreshSource: (e: React.ChangeEvent<HTMLInputElement>, sourceId: string) => void;
  onCreateGroup: () => void;
  onMoveSource: (sid: string, tid: string | null) => void;
}

const SourceTreeItem: React.FC<{
  source: Source;
  allSources: Source[];
  articles: Article[];
  activeSourceId: string | null;
  depth: number;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onRefresh: (e: React.ChangeEvent<HTMLInputElement>, id: string) => void;
  onAssignFolder: (folderId: string, groupId: string | null) => void;
}> = ({ source, allSources, articles, activeSourceId, depth, onSelect, onDelete, onRefresh, onAssignFolder }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  
  const children = allSources.filter(s => s.parentId === source.id);
  const hasChildren = children.length > 0;
  const count = articles.filter(a => a.sourceId === source.id).length;

  // Sync button only for root folders (depth 0 and not virtual)
  const isRefreshable = depth === 0 && !source.isVirtual;

  return (
    <div className="transition-all">
      <div className={`w-full flex items-center justify-between group hover:bg-slate-800 transition-colors ${activeSourceId === source.id ? 'bg-slate-800 text-white' : 'text-slate-300'}`} style={{ paddingLeft: `${depth * 12 + 12}px` }}>
        <div className="flex items-center gap-1 flex-1 min-w-0 py-2 cursor-pointer" onClick={() => onSelect(source.id)}>
          <div onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }} className={`p-1 rounded hover:bg-slate-700 ${hasChildren ? 'visible' : 'invisible'}`}>
             <svg className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" strokeWidth={2} /></svg>
          </div>
          <svg className={`w-4 h-4 shrink-0 ${source.isVirtual ? 'text-indigo-400' : 'text-slate-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" strokeWidth={2} />
          </svg>
          <span className={`truncate text-sm ml-1 ${source.isVirtual ? 'font-bold' : ''}`}>{source.name}</span>
          <span className="text-[10px] bg-slate-700 px-1.5 py-0.5 rounded-full ml-auto mr-1">{count}</span>
        </div>
        
        <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity pr-1">
          {source.isVirtual && (
            <div className="relative">
              <button onClick={(e) => { e.stopPropagation(); setShowFolderPicker(!showFolderPicker); }} className="p-1.5 text-indigo-400 hover:text-indigo-300">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" strokeWidth={2} /></svg>
              </button>
            </div>
          )}
          {isRefreshable && (
            <label className="p-1.5 text-slate-400 hover:text-emerald-400 cursor-pointer" title="Sync Master Folder">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" strokeWidth={2} /></svg>
              <input type="file" className="hidden" multiple webkitdirectory="" directory="" onChange={(e) => onRefresh(e, source.id)} />
            </label>
          )}
          <button onClick={(e) => { e.stopPropagation(); onDelete(source.id); }} className="p-1.5 text-slate-400 hover:text-red-400">
             <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7" strokeWidth={2} /></svg>
          </button>
        </div>
      </div>
      {isExpanded && hasChildren && (
        <div className="ml-2">
            {children.map(c => (
                <SourceTreeItem key={c.id} source={c} allSources={allSources} articles={articles} activeSourceId={activeSourceId} depth={depth + 1} onSelect={onSelect} onDelete={onDelete} onRefresh={onRefresh} onAssignFolder={onAssignFolder} />
            ))}
        </div>
      )}
    </div>
  );
};

export const Sidebar: React.FC<SidebarProps> = ({
  sources, articles, notes = [], categories, activeSourceId, activeCategoryId, onSetActiveSource, onSetActiveCategory, onOpenAddModal, onOpenGenerateModal, onOpenSettings, onOpenNote, onDeleteSource, isGenerateDisabled, onRefreshSource, onCreateGroup, onMoveSource
}) => {
  const groups = sources.filter(s => s.isVirtual);
  const libraryFolders = sources.filter(s => !s.isVirtual && !s.parentId);

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col border-r border-slate-800 shrink-0 select-none">
      <div className="p-6 border-b border-slate-800">
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <svg className="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
          Librarian
        </h1>
      </div>
      
      <nav className="flex-1 overflow-y-auto py-4">
        <button onClick={() => { onSetActiveSource(null); onSetActiveCategory(null); }} className={`w-full text-left px-6 py-3 flex justify-between hover:bg-slate-800 mb-4 transition-colors ${!activeSourceId && !activeCategoryId ? 'bg-slate-800 text-white' : ''}`}>
           <span className="text-sm font-semibold">All Library</span>
           <span className="text-xs bg-slate-700 px-2 py-0.5 rounded-full">{articles.length}</span>
        </button>

        <div className="mb-6">
            <div className="flex items-center justify-between px-6 mb-2">
                <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Groups</span>
                <button onClick={onCreateGroup} className="text-[10px] bg-slate-800 hover:bg-slate-700 px-2 py-0.5 rounded text-indigo-300 border border-slate-700">+ Group</button>
            </div>
            {groups.map(g => (
                <SourceTreeItem key={g.id} source={g} allSources={sources} articles={articles} activeSourceId={activeSourceId} depth={0} onSelect={onSetActiveSource} onDelete={onDeleteSource} onRefresh={onRefreshSource} onAssignFolder={onMoveSource} />
            ))}
        </div>

        <div className="mb-6">
            <div className="px-6 mb-2 text-[10px] font-bold uppercase text-slate-500 tracking-wider">Library Roots</div>
            {libraryFolders.map(s => (
                <SourceTreeItem key={s.id} source={s} allSources={sources} articles={articles} activeSourceId={activeSourceId} depth={0} onSelect={onSetActiveSource} onDelete={onDeleteSource} onRefresh={onRefreshSource} onAssignFolder={onMoveSource} />
            ))}
        </div>
        
        {notes.length > 0 && (
          <div className="mb-6 border-t border-slate-800 pt-4">
            <div className="px-6 mb-2 text-[10px] font-bold uppercase text-slate-500 tracking-wider">Recent Notes</div>
            <div className="space-y-1">
              {notes.slice(-8).reverse().map(n => (
                <button key={n.id} onClick={() => onOpenNote(n)} className="w-full text-left px-6 py-1.5 text-xs hover:bg-slate-800 text-slate-400 truncate flex items-center gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full ${n.type === 'category' ? 'bg-purple-500' : n.type === 'article' ? 'bg-amber-500' : 'bg-slate-500'}`}></span>
                  {n.title}
                </button>
              ))}
            </div>
          </div>
        )}

        {categories.length > 0 && (
          <div className="mt-8 border-t border-slate-800 pt-4">
            <div className="px-6 mb-2 text-[10px] font-bold uppercase text-slate-500 tracking-wider">Labels</div>
            {categories.map(cat => (
              <button key={cat} onClick={() => onSetActiveCategory(activeCategoryId === cat ? null : cat)} className={`w-full text-left px-6 py-1.5 text-xs hover:bg-slate-800 transition-colors ${activeCategoryId === cat ? 'bg-indigo-900/40 text-white border-l-2 border-indigo-500' : 'text-slate-400'}`}>
                {cat}
              </button>
            ))}
          </div>
        )}
      </nav>

      <div className="p-4 border-t border-slate-800 space-y-2">
        <button onClick={onOpenGenerateModal} disabled={isGenerateDisabled} className={`w-full font-bold py-2.5 rounded-lg transition-all flex items-center justify-center gap-2 ${isGenerateDisabled ? 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-50' : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}>
          Generate Output
        </button>
        <button onClick={onOpenAddModal} className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium py-2 rounded-lg transition-colors border border-slate-700">Add Library</button>
        <button onClick={onOpenSettings} className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium py-2 rounded-lg transition-colors border border-slate-700">Settings</button>
      </div>
    </aside>
  );
};
