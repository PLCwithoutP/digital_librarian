
import React from 'react';

interface AddSourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddSource: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onAddPDF: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const AddSourceModal: React.FC<AddSourceModalProps> = ({
  isOpen,
  onClose,
  onAddSource,
  onAddPDF,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-sm flex flex-col border border-slate-200 dark:border-slate-800 animate-fade-in-up">
        
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Add Content</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-4">
          <label className="flex items-center justify-center gap-3 w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 rounded-lg cursor-pointer transition-colors shadow-md group">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <div className="flex flex-col items-start">
                <span className="text-sm font-bold">Add Folder</span>
                <span className="text-[10px] opacity-80 font-normal">Import multiple PDFs recursively</span>
            </div>
            <input 
              type="file" 
              className="hidden" 
              onChange={(e) => {
                  onAddSource(e);
                  onClose();
              }}
              multiple
              // @ts-ignore
              webkitdirectory=""
              directory=""
            />
          </label>

          <label className="flex items-center justify-center gap-3 w-full bg-slate-700 hover:bg-slate-600 text-white font-medium py-3 rounded-lg cursor-pointer transition-colors shadow-md group">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            <div className="flex flex-col items-start">
                <span className="text-sm font-bold">Add PDF Files</span>
                <span className="text-[10px] opacity-80 font-normal">Select individual files</span>
            </div>
            <input 
              type="file" 
              className="hidden" 
              onChange={(e) => {
                  onAddPDF(e);
                  onClose();
              }}
              accept=".pdf,.json"
              multiple
            />
          </label>
        </div>
      </div>
    </div>
  );
};
