
import React, { useState, useEffect } from 'react';

interface GenerateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (options: { 
      references: boolean; 
      notes: boolean; 
      notesOptions: {
          general: boolean;
          category: boolean;
          article: boolean;
      };
      format?: string 
  }) => void;
}

export const GenerateModal: React.FC<GenerateModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
}) => {
  const [includeReferences, setIncludeReferences] = useState(false);
  const [includeNotes, setIncludeNotes] = useState(false);
  const [notesFormat, setNotesFormat] = useState('.txt');
  
  const [includeGeneralNotes, setIncludeGeneralNotes] = useState(true);
  const [includeCategoryNotes, setIncludeCategoryNotes] = useState(true);
  // Article-type is always true but disabled as per requirement
  const [includeArticleNotes] = useState(true);

  useEffect(() => {
    if (isOpen) {
      setIncludeReferences(false);
      setIncludeNotes(false);
      setNotesFormat('.txt');
      setIncludeGeneralNotes(true);
      setIncludeCategoryNotes(true);
    }
  }, [isOpen]);

  const handleConfirm = () => {
    onConfirm({
      references: includeReferences,
      notes: includeNotes,
      notesOptions: {
          general: includeGeneralNotes,
          category: includeCategoryNotes,
          article: includeArticleNotes
      },
      format: includeNotes ? notesFormat : undefined
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-sm flex flex-col border border-slate-200 dark:border-slate-800 animate-fade-in-up">
        
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Generate Output</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-5">
            {/* References Checkbox */}
            <div className="flex items-center justify-between">
                <label htmlFor="chk-refs" className="text-sm font-semibold text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                    References
                </label>
                <input 
                    id="chk-refs"
                    type="checkbox" 
                    className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    checked={includeReferences}
                    onChange={(e) => setIncludeReferences(e.target.checked)}
                />
            </div>

            {/* Notes Checkbox */}
            <div>
                <div className="flex items-center justify-between">
                    <label htmlFor="chk-notes" className="text-sm font-semibold text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                        Notes
                    </label>
                    <input 
                        id="chk-notes"
                        type="checkbox" 
                        className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        checked={includeNotes}
                        onChange={(e) => setIncludeNotes(e.target.checked)}
                    />
                </div>
                
                {includeNotes && (
                    <div className="mt-3 ml-2 pl-4 border-l-2 border-indigo-100 dark:border-indigo-900/30 space-y-2 animate-fade-in-up">
                        <div className="flex items-center gap-3">
                             <input 
                                id="chk-note-general"
                                type="checkbox"
                                className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                checked={includeGeneralNotes}
                                onChange={(e) => setIncludeGeneralNotes(e.target.checked)}
                             />
                             <label htmlFor="chk-note-general" className="text-xs text-slate-600 dark:text-slate-400 cursor-pointer">General Notes</label>
                        </div>
                        <div className="flex items-center gap-3">
                             <input 
                                id="chk-note-category"
                                type="checkbox"
                                className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                checked={includeCategoryNotes}
                                onChange={(e) => setIncludeCategoryNotes(e.target.checked)}
                             />
                             <label htmlFor="chk-note-category" className="text-xs text-slate-600 dark:text-slate-400 cursor-pointer">Category Notes</label>
                        </div>
                        <div className="flex items-center gap-3 opacity-60">
                             <input 
                                id="chk-note-article"
                                type="checkbox"
                                className="w-4 h-4 rounded border-slate-300 text-slate-400 cursor-not-allowed"
                                checked={includeArticleNotes}
                                disabled={true}
                             />
                             <label htmlFor="chk-note-article" className="text-xs text-slate-600 dark:text-slate-400 cursor-not-allowed">Article-type Notes</label>
                        </div>
                    </div>
                )}
            </div>

            {/* Format Dropdown (Conditional) */}
            {includeNotes && (
                <div className="animate-fade-in-up pt-2 border-t border-slate-100 dark:border-slate-800">
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                        Notes Format
                    </label>
                    <select 
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-colors"
                        value={notesFormat}
                        onChange={(e) => setNotesFormat(e.target.value)}
                    >
                        <option value=".txt">.txt (Plain Text)</option>
                        <option value=".dat">.dat (Data File)</option>
                        <option value=".tex">.tex (LaTeX)</option>
                    </select>
                </div>
            )}
        </div>

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
