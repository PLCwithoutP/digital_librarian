
import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Note } from '../types';

interface NoteViewerModalProps {
  note: Note | null;
  onClose: () => void;
  onUpdateTitle: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  onEdit: (note: Note) => void;
}

export const NoteViewerModal: React.FC<NoteViewerModalProps> = ({
  note,
  onClose,
  onUpdateTitle,
  onDelete,
  onEdit
}) => {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [title, setTitle] = useState('');

  useEffect(() => {
    if (note) {
      setTitle(note.title);
      setIsEditingTitle(false);
    }
  }, [note]);

  const handleTitleSave = () => {
    if (note && title.trim()) {
      onUpdateTitle(note.id, title.trim());
      setIsEditingTitle(false);
    }
  };

  const handleDelete = () => {
      if (note && window.confirm("Are you sure you want to delete this note?")) {
          onDelete(note.id);
          // Note: The parent component should handle closing the modal after deletion
          // to ensure state is synchronized.
      }
  };

  // Pre-process content to handle newlines as line breaks for Markdown
  const formattedContent = note?.content.replace(/\n/g, '  \n') || '';

  if (!note) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-2xl flex flex-col h-[80vh] border border-slate-200 dark:border-slate-800 animate-fade-in-up">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex-1 mr-4">
             <div className="flex items-center gap-2 mb-1">
                <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${
                    note.type === 'category' 
                    ? 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800'
                    : 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                }`}>
                    {note.type === 'category' ? `Category: ${note.targetId}` : 'General Note'}
                </span>
                <span className="text-xs text-slate-400 dark:text-slate-500">
                    {new Date(note.createdAt).toLocaleDateString()}
                </span>
             </div>

             {isEditingTitle ? (
                 <div className="flex items-center gap-2">
                     <input 
                        autoFocus
                        type="text" 
                        className="flex-1 bg-white dark:bg-slate-800 border border-indigo-500 rounded px-2 py-1 text-lg font-bold text-slate-900 dark:text-white outline-none"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleTitleSave()}
                        onBlur={handleTitleSave}
                     />
                 </div>
             ) : (
                 <h2 
                    className="text-xl font-bold text-slate-900 dark:text-white cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex items-center gap-2 group"
                    onClick={() => setIsEditingTitle(true)}
                    title="Click to rename"
                 >
                    {note.title}
                    <svg className="w-4 h-4 opacity-0 group-hover:opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                 </h2>
             )}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 prose dark:prose-invert max-w-none bg-slate-50 dark:bg-slate-950/50">
            <ReactMarkdown>{formattedContent}</ReactMarkdown>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex justify-between bg-white dark:bg-slate-900 rounded-b-xl">
             <button 
                onClick={handleDelete}
                className="text-red-500 hover:text-red-700 text-sm font-medium flex items-center gap-1"
             >
                 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                 </svg>
                 Delete Note
             </button>
             
             <div className="flex items-center gap-3">
               <button 
                  onClick={onClose}
                  className="px-4 py-2 text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 font-medium"
               >
                  Close
               </button>
               <button 
                  onClick={() => onEdit(note)}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
               >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                  Edit Note
               </button>
             </div>
        </div>
      </div>
    </div>
  );
};
