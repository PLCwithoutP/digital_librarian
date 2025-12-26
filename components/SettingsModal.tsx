
import React from 'react';

export type ThemeOption = 'default' | 'light' | 'dark';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTheme: ThemeOption;
  onThemeChange: (theme: ThemeOption) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  currentTheme,
  onThemeChange,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-md p-6 border border-slate-200 dark:border-slate-700 transform transition-all">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Settings</h2>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
              Appearance
            </label>
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => onThemeChange('default')}
                className={`flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all ${
                  currentTheme === 'default'
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30'
                    : 'border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500'
                }`}
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-white to-slate-800 border border-slate-300 shadow-sm mb-2"></div>
                <span className={`text-sm font-medium ${currentTheme === 'default' ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-600 dark:text-slate-400'}`}>
                  Default
                </span>
              </button>

              <button
                onClick={() => onThemeChange('light')}
                className={`flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all ${
                  currentTheme === 'light'
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30'
                    : 'border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500'
                }`}
              >
                <div className="w-8 h-8 rounded-full bg-white border border-slate-300 shadow-sm mb-2"></div>
                <span className={`text-sm font-medium ${currentTheme === 'light' ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-600 dark:text-slate-400'}`}>
                  Light
                </span>
              </button>

              <button
                onClick={() => onThemeChange('dark')}
                className={`flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all ${
                  currentTheme === 'dark'
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30'
                    : 'border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500'
                }`}
              >
                <div className="w-8 h-8 rounded-full bg-slate-900 border border-slate-700 shadow-sm mb-2"></div>
                <span className={`text-sm font-medium ${currentTheme === 'dark' ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-600 dark:text-slate-400'}`}>
                  Dark
                </span>
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              Choose your preferred color theme. "Default" uses your system preference.
            </p>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-700 flex justify-end">
          <button 
            onClick={onClose}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
