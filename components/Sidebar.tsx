import React, { useState } from 'react';
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
  onDeleteSource: (id: string) => void;
  onExportMetadata: () => void;
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
  const directArticleCount = articles.filter(a => a.sourceId === source.id).length;

  return (
    <div>
      <div className={`w-full flex items-center justify-between group hover:bg-slate-800 transition-colors ${activeSourceId === source.id ? 'bg-slate-800 text-white' : 'text-slate-300'}`} style={{ paddingLeft: `${depth * 12 + 12}px` }}>
        <div className="flex items-center gap-1 flex-1 min-w-0 py-2 cursor-pointer" onClick={() => onSelect(source.id)}>
          <div onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }} className={`p-1 rounded hover:bg-slate-700 ${hasChildren ? 'visible' : 'invisible'}`}>
             <svg className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </div>
          <svg className="w-4 h-4 shrink-0 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
          <span className="truncate text-sm ml-1 select-none">{source.name}</span>
          <span className="text-[10px] bg-slate-700 px-1.5 py-0.5 rounded-full ml-auto mr-2">{directArticleCount}</span>
        </div>
        <button onClick={(e) => { e.stopPropagation(); onDelete(source.id); }} className="p-2 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
      </div>
      {isExpanded && hasChildren && (<div>{children.map(child => (<SourceTreeItem key={child.id} source={child} allSources={allSources} articles={articles} activeSourceId={activeSourceId} depth={depth + 1} onSelect={onSelect} onDelete={onDelete} />))}</div>)}
    </div>
  );
};

export const Sidebar: React.FC<SidebarProps> = ({
  sources, articles, notes = [], activeSourceId, onSetActiveSource, onOpenAddModal, onOpenGenerateModal, onOpenSettings, onOpenNote, onDeleteSource, onExportMetadata, isGenerateDisabled
}) => {
  const sidebarNotes = notes.filter(n => n.type !== 'article');
  const rootSources = sources.filter(s => !s.parentId);

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col border-r border-slate-800 shrink-0">
      <div className="p-6 border-b border-slate-800">
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <svg className="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
          Librarian
        </h1>
      </div>
      <nav className="flex-1 overflow-y-auto py-4 scrollbar-thin scrollbar-thumb-slate-700">
        <div className="px-6 mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Library</div>
        <button onClick={() => onSetActiveSource(null)} className={`w-full text-left px-6 py-2 flex items-center justify-between hover:bg-slate-800 transition-colors ${!activeSourceId ? 'bg-slate-800 text-white' : ''}`}>
          <div className="flex items-center gap-2"><svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg><span>All Articles</span></div>
          <span className="text-xs bg-slate-700 px-2 py-0.5 rounded-full">{articles.length}</span>
        </button>
        <div className="mt-4">{rootSources.map(source => (<SourceTreeItem key={source.id} source={source} allSources={sources} articles={articles} activeSourceId={activeSourceId} depth={0} onSelect={onSetActiveSource} onDelete={onDeleteSource} />))}</div>
        {sidebarNotes.length > 0 && (<><div className="px-6 mt-6 mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500 border-t border-slate-800 pt-4">Notes</div>{sidebarNotes.map(note => (<button key={note.id} onClick={() => onOpenNote(note)} className="w-full text-left px-6 py-2 flex items-center gap-3 hover:bg-slate-800 transition-colors group"><svg className={`w-4 h-4 shrink-0 ${note.type === 'category' ? 'text-purple-400' : 'text-slate-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">{note.type === 'category' ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /> : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />}</svg><span className="truncate text-sm">{note.title}</span></button>))}</>)}
      </nav>
      <div className="p-4 border-t border-slate-800 space-y-2">
        <button onClick={onOpenAddModal} className="flex items-center justify-center gap-2 w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 rounded-lg transition-colors shadow-lg"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>Add</button>
        <button onClick={onExportMetadata} className="flex items-center justify-center gap-2 w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium py-2 rounded-lg transition-colors border border-slate-700" title="Export parsed_pdfs.json"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>Export Metadata</button>
        <button onClick={onOpenGenerateModal} disabled={isGenerateDisabled} className={`flex items-center justify-center gap-2 w-full font-medium py-2 rounded-lg transition-colors shadow-lg ${isGenerateDisabled ? 'bg-slate-800 text-slate-600 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700 text-white'}`}><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>Generate</button>
        <div className="grid grid-cols-1 pt-2 border-t border-slate-700/50"><button onClick={onOpenSettings} className="flex items-center justify-center gap-2 w-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-medium py-2 rounded-lg transition-colors border border-slate-700"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>Settings</button></div>
      </div>
    </aside>
  );
};