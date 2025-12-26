
import React, { useState, useEffect } from 'react';
import { Article, NoteType } from '../types';

interface NotebookModalProps {
  isOpen: boolean;
  onClose: () => void;
  articles: Article[];
  categories: string[];
  onConfirm: (type: NoteType, targetId?: string) => void;
}

export const NotebookModal: React.FC<NotebookModalProps> = ({
  isOpen,
  onClose,
  articles,
  categories,
  onConfirm,
}) => {
  const [noteType, setNoteType] = useState<NoteType>('general');
  const [targetId, setTargetId] = useState<string>('');
  
  // Reset state when opened
  useEffect(() => {
    if (isOpen) {
      setNoteType('general');
      setTargetId('');
    }
  }, [isOpen]);

  const handleConfirm = () => {
    if (noteType === 'article' && !targetId) {
      alert("Please select an article.");
      return;
    }
    if (noteType === 'category' && !targetId) {
      alert("Please select a category.");
      return;
    }

    onConfirm(noteType, targetId || undefined);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-md flex flex-col border border-slate-200 dark:border-slate-800 animate-fade-in-up">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            New Note Setup
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Controls */}
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Note Type</label>
            <select 
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-colors"
              value={noteType}
              onChange={(e) => {
                setNoteType(e.target.value as NoteType);
                setTargetId('');
              }}
            >
              <option value="general">General Commentary</option>
              <option value="article">Article-specific</option>
              <option value="category">Category Commentary</option>
            </select>
          </div>

          {noteType === 'article' && (
            <div className="animate-fade-in-up">
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Select Article</label>
              <select 
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-colors"
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
              >
                <option value="">-- Choose Article --</option>
                {articles.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.metadata?.title || a.fileName}
                  </option>
                ))}
              </select>
            </div>
          )}

          {noteType === 'category' && (
            <div className="animate-fade-in-up">
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Select Category</label>
              <select 
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-colors"
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
              >
                <option value="">-- Choose Category --</option>
                {categories.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3 bg-slate-50 dark:bg-slate-900 rounded-b-xl">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleConfirm}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
};
