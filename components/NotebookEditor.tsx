
import React, { useState, useEffect } from 'react';
import { Note, NoteType } from '../types';

interface NotebookEditorProps {
  isOpen: boolean;
  initialData: Partial<Note>;
  onClose: () => void;
  onSave: (note: Partial<Note>) => void;
  isEditing: boolean;
}

export const NotebookEditor: React.FC<NotebookEditorProps> = ({
  isOpen,
  initialData,
  onClose,
  onSave,
  isEditing
}) => {
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');

  useEffect(() => {
    if (isOpen) {
      setContent(initialData.content || '');
      setTitle(initialData.title || `Note ${Date.now().toString().slice(-4)}`);
    }
  }, [isOpen, initialData]);

  const handleSave = () => {
    if (!content.trim()) {
      alert("Note content cannot be empty.");
      return;
    }
    onSave({
      ...initialData,
      title,
      content
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] flex flex-col h-[400px] transition-transform duration-300 ease-in-out transform translate-y-0">
      
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
        <div className="flex items-center gap-4 flex-1">
           <div className="flex items-center gap-2">
             <span className="text-xs font-bold uppercase text-slate-500 tracking-wider">
               {isEditing ? 'Editing:' : 'New Note:'}
             </span>
             <span className={`text-xs px-2 py-0.5 rounded border uppercase font-bold ${
                 initialData.type === 'category' ? 'bg-purple-100 text-purple-700 border-purple-200' :
                 initialData.type === 'article' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                 'bg-indigo-100 text-indigo-700 border-indigo-200'
             }`}>
                {initialData.type === 'category' ? `Category: ${initialData.targetId}` :
                 initialData.type === 'article' ? 'Article Reference' : 'General'}
             </span>
           </div>
           <input 
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="bg-transparent border-b border-transparent hover:border-slate-300 focus:border-indigo-500 focus:outline-none text-sm font-bold text-slate-800 dark:text-slate-200 px-1 py-0.5 w-64 transition-colors"
              placeholder="Note Title"
           />
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 text-sm font-medium"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-lg text-sm font-bold shadow-sm transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Save Note
          </button>
        </div>
      </div>

      {/* Editor Area */}
      <div className="flex-1 flex bg-white dark:bg-slate-900 relative">
        <textarea 
          className="flex-1 w-full h-full p-6 resize-none outline-none text-slate-800 dark:text-slate-200 font-mono text-sm leading-relaxed bg-transparent"
          placeholder="# Write your note here... Markdown is supported."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          autoFocus
        ></textarea>
        
        {/* Helper Hint */}
        <div className="absolute bottom-4 right-6 pointer-events-none opacity-30 text-xs">
           Markdown Supported
        </div>
      </div>
    </div>
  );
};
