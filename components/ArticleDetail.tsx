
import React from 'react';
import { Article } from '../types';
import { getFileFromDB } from '../db';

interface ArticleDetailProps {
  article: Article | null | undefined;
  onClose: () => void;
}

export const ArticleDetail: React.FC<ArticleDetailProps> = ({ article, onClose }) => {
  return (
    <div className={`fixed inset-y-0 right-0 w-[450px] bg-white shadow-2xl transform transition-transform duration-300 ease-in-out border-l border-slate-200 flex flex-col z-20 ${article ? 'translate-x-0' : 'translate-x-full'}`}>
      {article && (
        <>
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">Article Summary</h2>
            <button 
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 transition-colors p-1"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-8">
            <div className="space-y-8">
              <header>
                <h3 className="text-2xl font-serif font-bold leading-tight text-slate-900 mb-4">
                  {article.metadata?.title || article.fileName}
                </h3>
                <div className="space-y-2">
                  <div className="flex gap-2 text-sm">
                    <span className="font-semibold text-slate-500 w-16">Authors:</span>
                    <span className="text-slate-700 flex-1">{article.metadata?.authors?.join(', ') || 'Unknown'}</span>
                  </div>
                  <div className="flex gap-2 text-sm">
                    <span className="font-semibold text-slate-500 w-16">Year:</span>
                    <span className="text-slate-700">{article.metadata?.year || 'Unknown'}</span>
                  </div>
                </div>
              </header>

              <section>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Categories & Keywords</h4>
                <div className="flex flex-wrap gap-2">
                  {article.metadata?.categories?.length ? article.metadata.categories.map(cat => (
                    <span key={cat} className="px-2.5 py-1 bg-indigo-50 text-indigo-700 text-xs font-semibold rounded-md border border-indigo-100">
                      {cat}
                    </span>
                  )) : (
                    <span className="text-sm text-slate-400 italic">No categories</span>
                  )}
                  
                  {article.metadata?.keywords?.map(kw => (
                    <span key={kw} className="px-2.5 py-1 bg-slate-100 text-slate-600 text-xs font-medium rounded-md border border-slate-200">
                      {kw}
                    </span>
                  ))}
                </div>
              </section>

              <section className="bg-slate-50 p-6 rounded-xl border border-slate-100">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Abstract / Summary</h4>
                <p className="text-slate-700 leading-relaxed font-serif text-lg">
                  {article.metadata?.abstract || <span className="italic text-slate-400">No abstract available.</span>}
                </p>
              </section>
              
              <div className="pt-8 border-t border-slate-100">
                <button 
                  onClick={async () => {
                    const blob = await getFileFromDB(article.id);
                    if (blob) {
                      const url = URL.createObjectURL(blob);
                      window.open(url, '_blank');
                    }
                  }}
                  className="w-full py-3 bg-slate-900 text-white font-bold rounded-lg hover:bg-slate-800 transition-all shadow-md flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  Open PDF File
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
