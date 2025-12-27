import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { Article, Source, ArticleMetadata, Note, NoteType } from './types';
import { getAllData, saveArticleToDB, saveFileToDB, saveSourceToDB, saveNoteToDB, getFileFromDB, deleteSourceFromDB, deleteArticleFromDB, deleteFileFromDB, deleteNoteFromDB, clearDatabase, restoreSession } from './db';
import { Sidebar } from './components/Sidebar';
import { ArticleList } from './components/ArticleList';
import { ArticleDetail } from './components/ArticleDetail';
import { SettingsModal, ThemeOption } from './components/SettingsModal';
import { NotebookModal } from './components/NotebookModal';
import { NoteViewerModal } from './components/NoteViewerModal';
import { NotebookEditor } from './components/NotebookEditor';
import { AddSourceModal } from './components/AddSourceModal';
import { GenerateModal } from './components/GenerateModal';

// Helper to regenerate BibTeX based on metadata
const generateBibTeX = (oldBibtex: string | undefined, meta: ArticleMetadata, filename: string): string => {
    let key = '';
    let doi = '';
    let existingNote = '';
    let existingFile = '';
    let howpublished = '';
    
    if (oldBibtex) {
        const keyMatch = oldBibtex.match(/@\w+\s*\{\s*([^,]+),/);
        if (keyMatch) key = keyMatch[1];
        
        const doiMatch = oldBibtex.match(/doi\s*=\s*[\{"](.+?)[\}"]/i);
        if (doiMatch) doi = doiMatch[1];

        const noteMatch = oldBibtex.match(/note\s*=\s*[\{"](.+?)[\}"]/i);
        if (noteMatch) existingNote = noteMatch[1];
        
        const fileMatch = oldBibtex.match(/file\s*=\s*[\{"](.+?)[\}"]/i);
        if (fileMatch) existingFile = fileMatch[1];

        const howpMatch = oldBibtex.match(/howpublished\s*=\s*[\{"](.+?)[\}"]/i);
        if (howpMatch) howpublished = howpMatch[1];
    }

    if (!key) {
        // Generate a simple key: AuthorYearTitleWord
        const author = meta.authors[0]?.split(' ').pop()?.toLowerCase().replace(/[^a-z]/g, '') || 'unknown';
        const year = (meta.year && meta.year !== 'Unknown') ? meta.year : '0000';
        const titleWord = meta.title.split(' ')[0]?.toLowerCase().replace(/[^a-z]/g, '') || 'article';
        key = `${author}${year}${titleWord}`;
    }

    const isArticle = (meta.journal && meta.journal !== "Unknown Journal");
    const type = isArticle ? "article" : "misc";

    const lines: string[] = [];
    lines.push(`@${type}{${key},`);
    lines.push(`  author = {${meta.authors.join(' and ')}},`);
    lines.push(`  title = {${meta.title}},`);
    
    if (meta.year && meta.year !== 'Unknown') {
        lines.push(`  year = {${meta.year}},`);
    }
    
    if (isArticle) {
        lines.push(`  journal = {${meta.journal}},`);
    }
    if (meta.volume) {
        lines.push(`  volume = {${meta.volume}},`);
    }
    
    if (howpublished) {
        lines.push(`  howpublished = {${howpublished}},`);
    } else if (!isArticle) {
        lines.push(`  howpublished = {PDF},`);
    }
    
    if (doi) lines.push(`  doi = {${doi}},`);
    
    const note = existingNote || `Local PDF: ${filename}`;
    lines.push(`  note = {${note}},`);
    
    if (existingFile) {
        lines.push(`  file = {${existingFile}}`);
    }

    return lines.join('\n') + '\n}';
};

const LibrarianApp = () => {
  const [sources, setSources] = useState<Source[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSourceId, setActiveSourceId] = useState<string | null>(null);
  const [isGrouped, setIsGrouped] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [checkedArticleIds, setCheckedArticleIds] = useState<Set<string>>(new Set());
  
  // Loading State
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');

  // Settings & Theme
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [theme, setTheme] = useState<ThemeOption>('default');

  // Notebook State
  const [isNotebookSetupOpen, setIsNotebookSetupOpen] = useState(false);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [activeEditorNote, setActiveEditorNote] = useState<Partial<Note> | null>(null);
  const [isEditingNote, setIsEditingNote] = useState(false);

  // New Modals State
  const [isAddSourceModalOpen, setIsAddSourceModalOpen] = useState(false);
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);

  // Initialize theme
  useEffect(() => {
    const savedTheme = localStorage.getItem('librarian_theme') as ThemeOption | null;
    if (savedTheme) {
      setTheme(savedTheme);
    }
  }, []);

  // Apply theme
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('dark');

    if (theme === 'dark') {
      root.classList.add('dark');
    } else if (theme === 'default') {
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        root.classList.add('dark');
      }
    }
    
    // Save preference
    if (theme !== 'default') {
      localStorage.setItem('librarian_theme', theme);
    } else {
      localStorage.removeItem('librarian_theme');
    }
  }, [theme]);

  // Initialize fresh session on mount
  useEffect(() => {
    const initSession = async () => {
      setIsLoading(true);
      setLoadingMessage('Initializing library...');
      try {
        await clearDatabase();
        setSources([]);
        setArticles([]);
        setNotes([]);
      } catch (err) {
        console.error("Failed to initialize session", err);
      } finally {
        setIsLoading(false);
      }
    };
    initSession();
  }, []);

  const processMetadataFiles = async (files: File[]): Promise<Map<string, any>> => {
      const jsonFiles = files.filter(f => f.name.toLowerCase().endsWith('.json'));
      const pdfMetadataMap = new Map<string, any>();

      for (const jsonFile of jsonFiles) {
          try {
              const text = await jsonFile.text();
              const data = JSON.parse(text);
              
              // Handle 'pdfs' key (Standard format)
              if (data.pdfs && Array.isArray(data.pdfs)) {
                  data.pdfs.forEach((pdf: any) => {
                      if (pdf.file_name) {
                          pdfMetadataMap.set(pdf.file_name, pdf);
                      }
                  });
              }

              // Handle 'entries' key (BibTeX JSON format)
              if (data.entries && Array.isArray(data.entries)) {
                  data.entries.forEach((entry: any) => {
                      if (entry.file_name) {
                          const existing = pdfMetadataMap.get(entry.file_name) || {};
                          pdfMetadataMap.set(entry.file_name, { ...existing, ...entry });
                      }
                  });
              }
          } catch (err) {
              console.warn(`Failed to parse metadata file ${jsonFile.name}:`, err);
          }
      }
      return pdfMetadataMap;
  };

  const createMetadata = (file: File, meta: any | undefined): ArticleMetadata => {
      if (meta) {
          // Extract keywords
          let keywords: string[] = [];
          if (meta.pdf_meta && meta.pdf_meta['/Keywords']) {
             keywords = meta.pdf_meta['/Keywords'].split(/[;,]/)
                .map((k: string) => k.trim())
                .filter((k: string) => k);
          } else if (Array.isArray(meta.keywords)) {
             keywords = meta.keywords;
          }

          // Extract categories (Subject)
          let categories: string[] = [];
          if (meta.pdf_meta && meta.pdf_meta['/Subject']) {
              const subj = meta.pdf_meta['/Subject'].trim();
              if (subj) categories.push(subj);
          }
          if (categories.length === 0 && meta.categories && Array.isArray(meta.categories)) {
              categories = meta.categories;
          }
          if (categories.length === 0) categories.push("Uncategorized");

          // Extract Year
          let year = "Unknown";
          if (meta.year) {
              year = String(meta.year);
          } else if (meta.pdf_meta && meta.pdf_meta['/CreationDate']) {
              const match = meta.pdf_meta['/CreationDate'].match(/D:(\d{4})/);
              if (match) year = match[1];
          }

          // Extract Authors
          let authors: string[] = [];
          if (Array.isArray(meta.authors)) {
              authors = meta.authors;
          } else if (meta.pdf_meta && meta.pdf_meta['/Author']) {
              authors = [meta.pdf_meta['/Author']];
          }
          if (authors.length === 0) authors = ["Unknown Author"];
          
          return {
              title: meta.title || meta.pdf_meta?.['/Title'] || file.name.replace(/\.pdf$/i, ''),
              authors: authors,
              journal: meta.journal || "Unknown Journal",
              volume: meta.volume || "",
              year: year,
              abstract: meta.abstract || "",
              keywords: keywords,
              categories: categories,
              bibtex: meta.bibtex || "" 
          };
      } else {
          return {
              title: file.name.replace(/\.pdf$/i, ''),
              authors: ["Unknown"],
              journal: "Unknown Journal",
              volume: "",
              year: "Unknown",
              categories: ["Uncategorized"],
              keywords: [],
              abstract: "",
              bibtex: ""
          };
      }
  };

  const handleAddSource = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsLoading(true);
    setLoadingMessage('Processing folder structure...');

    try {
        const fileList: File[] = Array.from(files);
        
        // 1. Map paths to Source IDs
        // Map Key: "Folder/SubFolder", Value: sourceId
        const pathSourceIdMap = new Map<string, string>();
        const newSources: Source[] = [];
        
        // Helper to get or create source for a path
        const getOrCreateSource = (fullPath: string, folderName: string, parentPath: string | null): string => {
            if (pathSourceIdMap.has(fullPath)) {
                return pathSourceIdMap.get(fullPath)!;
            }

            const id = crypto.randomUUID();
            const parentId = parentPath ? pathSourceIdMap.get(parentPath) : undefined;
            
            // Check collision with existing root sources if no parent
            if (!parentId) {
                const existing = sources.find(s => s.name === folderName && !s.parentId);
                if (existing) {
                    // We treat it as a new import
                }
            }

            const newSource: Source = { id, name: folderName, parentId };
            newSources.push(newSource);
            pathSourceIdMap.set(fullPath, id);
            return id;
        };

        // 2. Pre-process metadata
        const pdfMetadataMap = await processMetadataFiles(fileList);
        const newArticles: Article[] = [];

        // 3. Iterate files to build structure and articles
        for (const file of fileList) {
            if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) continue;

            const relativePath = (file as any).webkitRelativePath || file.name;
            const pathParts = relativePath.split('/');
            
            // Handle root file vs nested
            let sourceId: string;
            
            if (pathParts.length > 1) {
                // It is in a folder
                // Reconstruct the folder path parts to create sources
                // e.g. "A/B/file.pdf" -> folders ["A", "B"]
                const folderParts = pathParts.slice(0, -1);
                
                let currentPath = "";
                let parentPath = null;

                for (let i = 0; i < folderParts.length; i++) {
                    const folderName = folderParts[i];
                    const prevPath = currentPath;
                    currentPath = currentPath ? `${currentPath}/${folderName}` : folderName;
                    
                    // Create Source if not exists
                    getOrCreateSource(currentPath, folderName, prevPath || null);
                }
                sourceId = pathSourceIdMap.get(currentPath)!;
            } else {
                const rootSourceName = "Imported Files";
                let rootSource = newSources.find(s => s.name === rootSourceName);
                if (!rootSource) {
                     // Check existing state sources too
                     const existingRoot = sources.find(s => s.name === rootSourceName);
                     if(existingRoot) {
                         sourceId = existingRoot.id;
                     } else {
                         sourceId = crypto.randomUUID();
                         newSources.push({ id: sourceId, name: rootSourceName });
                     }
                } else {
                    sourceId = rootSource.id;
                }
            }

            const meta = pdfMetadataMap.get(file.name);
            const articleMetadata = createMetadata(file, meta);
            const articleId = crypto.randomUUID();
            
            const article: Article = {
                id: articleId,
                sourceId,
                fileName: file.name,
                fileSize: file.size,
                addedAt: Date.now(),
                status: 'completed',
                metadata: articleMetadata
            };

            newArticles.push(article);
            // Save individually to avoid memory spikes, though we block UI
            await saveFileToDB(articleId, file);
            await saveArticleToDB(article);
        }

        // Save all new sources
        for (const s of newSources) {
            await saveSourceToDB(s);
        }

        setSources(prev => [...prev, ...newSources]);
        setArticles(prev => [...prev, ...newArticles]);

    } catch (err: any) {
        console.error("Import failed", err);
        alert("Failed to import folder structure.");
    } finally {
        setIsLoading(false);
        if (e.target) e.target.value = "";
    }
  };

  const handleAddPDF = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      setIsLoading(true);
      setLoadingMessage('Importing PDF files...');

      try {
        // Find or create "Uploaded Files" source
        let uploadSource = sources.find(s => s.name === "Uploaded Files");
        let sourceId = uploadSource?.id;

        if (!uploadSource) {
            sourceId = crypto.randomUUID();
            uploadSource = { id: sourceId, name: "Uploaded Files" };
            setSources(prev => [...prev, uploadSource!]);
            await saveSourceToDB(uploadSource);
        } else {
            sourceId = uploadSource.id;
        }

        const fileList: File[] = Array.from(files);
        const pdfMetadataMap = await processMetadataFiles(fileList);
        const newArticles: Article[] = [];

        for (const file of fileList) {
            if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) continue;

            const meta = pdfMetadataMap.get(file.name);
            const articleMetadata = createMetadata(file, meta);

            const articleId = crypto.randomUUID();
            const article: Article = {
                id: articleId,
                sourceId: sourceId!,
                fileName: file.name,
                fileSize: file.size,
                addedAt: Date.now(),
                status: 'completed',
                metadata: articleMetadata
            };

            newArticles.push(article);
            await saveFileToDB(articleId, file);
            await saveArticleToDB(article);
        }

        setArticles(prev => [...prev, ...newArticles]);
      } catch(err: any) {
          console.error(err);
          alert("Error importing files.");
      } finally {
        setIsLoading(false);
        if (e.target) e.target.value = "";
      }
  };

  const handleReplacePdf = async (articleId: string, file: File) => {
      setIsLoading(true);
      setLoadingMessage('Replacing PDF file...');
      try {
        await saveFileToDB(articleId, file);
        const article = articles.find(a => a.id === articleId);
        if (article) {
            const updated = { ...article, fileSize: file.size };
            await saveArticleToDB(updated);
            setArticles(prev => prev.map(a => a.id === articleId ? updated : a));
        }
      } catch(err: any) {
        console.error(err);
        alert("Failed to replace PDF.");
      } finally {
        setIsLoading(false);
      }
  };

  const handleDeleteSource = async (sourceIdToDelete: string) => {
      if(!window.confirm("Are you sure? This will delete this folder, all sub-folders, and all articles within them.")) return;

      setIsLoading(true);
      setLoadingMessage('Deleting source and contents...');

      try {
          // 1. Identify all descendant source IDs (Recursive)
          const allSourceIds = new Set<string>();
          const gatherIds = (id: string) => {
              allSourceIds.add(id);
              const children = sources.filter(s => s.parentId === id);
              children.forEach(c => gatherIds(c.id));
          };
          gatherIds(sourceIdToDelete);

          // 2. Identify articles to delete
          const articlesToDelete = articles.filter(a => allSourceIds.has(a.sourceId));
          const articleIdsToDelete = new Set(articlesToDelete.map(a => a.id));

          // 3. Identify notes to delete (linked to these articles)
          const notesToDelete = notes.filter(n => n.type === 'article' && n.targetId && articleIdsToDelete.has(n.targetId));

          // 4. Perform DB Deletions
          // Sources
          await Promise.all(Array.from(allSourceIds).map((id: string) => deleteSourceFromDB(id)));
          
          // Articles & Files
          await Promise.all(Array.from(articleIdsToDelete).map(async (id: string) => {
              await deleteArticleFromDB(id);
              await deleteFileFromDB(id);
          }));

          // Notes
          await Promise.all(notesToDelete.map(n => deleteNoteFromDB(n.id)));

          // 5. Update State
          setSources(prev => prev.filter(s => !allSourceIds.has(s.id)));
          setArticles(prev => prev.filter(a => !articleIdsToDelete.has(a.id)));
          setNotes(prev => prev.filter(n => !notesToDelete.includes(n)));
          
          setCheckedArticleIds(prev => {
            const next = new Set(prev);
            articleIdsToDelete.forEach(id => next.delete(id));
            return next;
          });

          if (activeSourceId && allSourceIds.has(activeSourceId)) {
              setActiveSourceId(null);
          }
          if (selectedArticleId && articleIdsToDelete.has(selectedArticleId)) {
              setSelectedArticleId(null);
          }

      } catch (err: any) {
          console.error("Delete source failed", err);
          alert("Failed to delete source.");
      } finally {
          setIsLoading(false);
      }
  };

  const handleGenerateConfirm = async (options: { 
      references: boolean; 
      notes: boolean; 
      notesOptions: { general: boolean; category: boolean; article: boolean };
      format?: string 
  }) => {
    
    setIsLoading(true);
    setLoadingMessage('Generating output...');

    // Small delay to allow UI to render loading state
    await new Promise(r => setTimeout(r, 100));

    try {
        const selectedArticles = articles.filter(a => checkedArticleIds.has(a.id));

        // 1. Generate References
        if (options.references) {
            const bibtexContent = selectedArticles
                .map(a => a.metadata?.bibtex || "")
                .filter(b => b.trim().length > 0)
                .join('\n\n');
            
            if (bibtexContent) {
                const blob = new Blob([bibtexContent], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'references_1.bib';
                a.click();
                URL.revokeObjectURL(url);
            }
        }

        // 2. Generate Notes
        if (options.notes) {
            let content = '';
            const generalNotes = options.notesOptions.general ? notes.filter(n => n.type === 'general') : [];
            const categoryNotes = options.notesOptions.category ? notes.filter(n => n.type === 'category') : [];
            const articleNotes = options.notesOptions.article ? notes.filter(n => n.type === 'article' && n.targetId && checkedArticleIds.has(n.targetId)) : [];
            
            // --- Markdown Format ---
            if (options.format === '.md') {
                if (generalNotes.length > 0) {
                    content += "# General Notes\n\n";
                    generalNotes.forEach(n => {
                        content += `## ${n.title}\n${n.content}\n\n`;
                    });
                }
                if (categoryNotes.length > 0) {
                    content += "# Category Notes\n\n";
                    // Group by category
                    const catGroups: Record<string, Note[]> = {};
                    categoryNotes.forEach(n => {
                        if (n.targetId) {
                            if (!catGroups[n.targetId]) catGroups[n.targetId] = [];
                            catGroups[n.targetId].push(n);
                        }
                    });
                    Object.entries(catGroups).forEach(([cat, ns]) => {
                        content += `### ${cat}\n`;
                        ns.forEach(n => content += `#### ${n.title}\n${n.content}\n\n`);
                    });
                }
                if (articleNotes.length > 0) {
                    content += "# Article-specific Notes\n\n";
                    articleNotes.forEach(n => {
                        const art = articles.find(a => a.id === n.targetId);
                        const artTitle = art?.metadata?.title || art?.fileName || "Unknown Article";
                        content += `## ${n.title}\nThis subsection belongs to ${artTitle}.\n\n${n.content}\n\n`;
                    });
                }
            } 
            // --- TeX Format ---
            else if (options.format === '.tex') {
                const formatTexContent = (text: string) => {
                    // 1. Preserve explicit escapes \_ and \^
                    let out = text.replace(/\\_/g, '@@ESC-US@@')
                                  .replace(/\\\^/g, '@@ESC-CARET@@');
                    
                    // 2. Escape other special chars
                    out = out.replace(/[\\#$|%&{}~]/g, (match) => {
                        switch (match) {
                            case '\\': return '\\textbackslash{}';
                            case '#': return '\\#';
                            case '$': return '\\$';
                            case '%': return '\\%';
                            case '&': return '\\&';
                            case '{': return '\\{';
                            case '}': return '\\}';
                            case '~': return '\\textasciitilde{}';
                            case '|': return '\\textbar{}';
                            default: return match;
                        }
                    });

                    // 3. Wrap math-like words (containing _ or ^) in $...$
                    out = out.replace(/(\S*[_\^]\S*)/g, (match) => {
                         return `$${match}$`;
                    });
                    
                    // 4. Restore explicit escapes
                    out = out.replace(/@@ESC-US@@/g, '\\_')
                             .replace(/@@ESC-CARET@@/g, '\\^');
                             
                    return out;
                };

                content += `\\documentclass{article}\n\\usepackage{amsmath}\n\\title{Notes of Librarian}\n\\begin{document}\n\\maketitle\n\n`;
                
                if (generalNotes.length > 0) {
                    content += `\\section{General Notes}\n`;
                    generalNotes.forEach(n => {
                        content += `\\subsection{${n.title}}\n${formatTexContent(n.content)}\n\n`;
                    });
                }

                if (categoryNotes.length > 0) {
                    content += `\\section{Category Notes}\n`;
                    const catGroups: Record<string, Note[]> = {};
                    categoryNotes.forEach(n => {
                        if (n.targetId) {
                            if (!catGroups[n.targetId]) catGroups[n.targetId] = [];
                            catGroups[n.targetId].push(n);
                        }
                    });
                    Object.entries(catGroups).forEach(([cat, ns]) => {
                        content += `\\subsection{${cat}}\n`;
                        ns.forEach(n => content += `\\subsubsection{${n.title}}\n${formatTexContent(n.content)}\n\n`);
                    });
                }

                const referencedArticleIds = new Set<string>();

                if (articleNotes.length > 0) {
                    content += `\\section{Article-specific Notes}\n`;
                    articleNotes.forEach(n => {
                        if (n.targetId) referencedArticleIds.add(n.targetId);
                        const art = articles.find(a => a.id === n.targetId);
                        const artTitle = art?.metadata?.title || art?.fileName || "Unknown Article";
                        content += `\\subsection{${n.title}}\nThis subsection belongs to \\textit{${artTitle}}.\n\n${formatTexContent(n.content)}\n\n`;
                    });
                }

                // Append \nocite for each article referenced in notes
                if (referencedArticleIds.size > 0) {
                    const referencedArticles = articles.filter(a => referencedArticleIds.has(a.id));
                    const noteBibtexEntries: string[] = [];
                    const noteCitationKeys: Set<string> = new Set();

                    referencedArticles.forEach(a => {
                        const bib = a.metadata?.bibtex;
                        if (bib) {
                            noteBibtexEntries.push(bib);
                            const match = bib.match(/@\w+\s*\{\s*([^,]+),/);
                            if (match && match[1]) {
                                noteCitationKeys.add(match[1].trim());
                            }
                        }
                    });

                    if (noteCitationKeys.size > 0) {
                        noteCitationKeys.forEach(key => {
                            content += `\\nocite{${key}}\n`;
                        });
                        content += `\n\\clearpage\n\\bibliographystyle{plain}\n\\bibliography{references_for_notes_1}\n`;
                    }

                    if (noteBibtexEntries.length > 0) {
                        const bibBlob = new Blob([noteBibtexEntries.join('\n\n')], { type: 'text/plain' });
                        const bibUrl = URL.createObjectURL(bibBlob);
                        const bibLink = document.createElement('a');
                        bibLink.href = bibUrl;
                        bibLink.download = 'references_for_notes_1.bib';
                        bibLink.click();
                        URL.revokeObjectURL(bibUrl);
                    }
                }

                content += `\\end{document}`;
            }

            if (content) {
                const blob = new Blob([content], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `notes${options.format}`;
                a.click();
                URL.revokeObjectURL(url);
            }
        }
    } catch(e: any) {
        console.error(e);
        alert("Failed to generate output");
    } finally {
        setIsLoading(false);
    }
  };

  const handleUpdateArticle = async (id: string, updates: Partial<ArticleMetadata>) => {
    const articleIndex = articles.findIndex(a => a.id === id);
    if (articleIndex === -1) return;

    const currentArticle = articles[articleIndex];
    const newMetadata = { ...currentArticle.metadata!, ...updates };
    
    // Regenerate BibTeX based on new metadata
    const newBibtex = generateBibTeX(currentArticle.metadata?.bibtex, newMetadata, currentArticle.fileName);
    newMetadata.bibtex = newBibtex;
    
    const updatedArticle = { ...currentArticle, metadata: newMetadata };

    await saveArticleToDB(updatedArticle);
    setArticles(prev => {
      const newArr = [...prev];
      newArr[articleIndex] = updatedArticle;
      return newArr;
    });
  };

  const handleSetupNote = (type: NoteType, targetId?: string) => {
    setIsEditingNote(false);
    let defaultTitle = `Note ${Date.now().toString().slice(-4)}`;
    
    // Improved title generation for articles
    if (type === 'article' && targetId) {
        const art = articles.find(a => a.id === targetId);
        if (art) {
            defaultTitle = `Notes on ${art.metadata?.title || art.fileName}`;
        }
    }

    setActiveEditorNote({
        type,
        targetId,
        content: '',
        title: defaultTitle
    });
  };

  const handleSaveNote = async (noteData: Partial<Note>) => {
    let newNote: Note;
    if (isEditingNote && noteData.id) {
        // Update existing
        const existing = notes.find(n => n.id === noteData.id);
        if (!existing) return;
        newNote = { ...existing, ...noteData } as Note;
    } else {
        // Create new
        newNote = {
            id: crypto.randomUUID(),
            createdAt: Date.now(),
            title: noteData.title || 'Untitled Note',
            content: noteData.content || '',
            type: noteData.type || 'general',
            targetId: noteData.targetId
        };
    }

    await saveNoteToDB(newNote);
    setNotes(prev => {
        if (isEditingNote) {
            return prev.map(n => n.id === newNote.id ? newNote : n);
        } else {
            return [...prev, newNote];
        }
    });

    // If we were editing the currently viewed note, update it too
    if (selectedNote && selectedNote.id === newNote.id) {
        setSelectedNote(newNote);
    }
  };

  const handleUpdateNoteTitle = async (id: string, newTitle: string) => {
      const noteIndex = notes.findIndex(n => n.id === id);
      if (noteIndex === -1) return;

      const updatedNote = { ...notes[noteIndex], title: newTitle };
      await saveNoteToDB(updatedNote);
      setNotes(prev => {
          const newArr = [...prev];
          newArr[noteIndex] = updatedNote;
          return newArr;
      });
      // Important: Update the view modal if it is displaying this note
      if (selectedNote && selectedNote.id === id) {
          setSelectedNote(updatedNote);
      }
  };

  const handleDeleteNote = async (id: string) => {
      try {
        await deleteNoteFromDB(id);
        setNotes(prev => prev.filter(n => n.id !== id));
        if (selectedNote && selectedNote.id === id) {
            setSelectedNote(null);
        }
      } catch (e: any) {
        console.error("Failed to delete note", e);
        alert("Failed to delete note.");
      }
  };

  const handleEditNote = (note: Note) => {
      setSelectedNote(null); // Close viewer if open
      setIsEditingNote(true);
      setActiveEditorNote(note); // Open editor with note data
  };

  const handleSaveSession = async () => {
    setIsLoading(true);
    setLoadingMessage('Saving session...');
    try {
      const { sources, articles, notes } = await getAllData();
      const session = {
        timestamp: Date.now(),
        sources,
        articles,
        notes
      };
      const blob = new Blob([JSON.stringify(session, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `librarian-session-${new Date().toISOString().slice(0,10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error("Save session failed", err);
      alert("Failed to save session.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteSelected = async () => {
    if (checkedArticleIds.size === 0) return;

    if (window.confirm(`Are you sure you want to delete ${checkedArticleIds.size} selected articles?`)) {
      setIsLoading(true);
      setLoadingMessage('Deleting selected articles...');
      try {
        const idsToDelete = Array.from(checkedArticleIds);
        
        // 1. Delete Articles and Files from DB
        await Promise.all(idsToDelete.map(async (id: string) => {
            await deleteArticleFromDB(id);
            await deleteFileFromDB(id);
        }));
        
        // 2. Delete associated notes from DB
        const notesToDelete = notes.filter(n => n.type === 'article' && n.targetId && checkedArticleIds.has(n.targetId as string));
        await Promise.all(notesToDelete.map(n => deleteNoteFromDB(n.id)));

        // 3. Update State
        setArticles(prev => prev.filter(a => !checkedArticleIds.has(a.id)));
        setNotes(prev => prev.filter(n => !(n.type === 'article' && n.targetId && checkedArticleIds.has(n.targetId as string))));
        
        setCheckedArticleIds(new Set());
        
        if (selectedArticleId && checkedArticleIds.has(selectedArticleId)) {
            setSelectedArticleId(null);
        }
      } catch (err: any) {
        console.error("Delete articles failed", err);
        alert("Failed to delete articles.");
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleImportSession = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      if (!window.confirm("Importing a session will replace all current data. Continue?")) return;
      
      setIsLoading(true);
      setLoadingMessage('Importing session data...');
      try {
        const text = await file.text();
        const session = JSON.parse(text);
        
        if (!Array.isArray(session.sources) || !Array.isArray(session.articles)) {
          alert("Invalid session file format. Missing sources or articles.");
          return;
        }

        // Reset first
        await clearDatabase();
        
        // Restore
        await restoreSession(session.sources, session.articles, session.notes || []);
        setSources(session.sources);
        setArticles(session.articles);
        setNotes(session.notes || []);
        setSelectedArticleId(null);
        setActiveSourceId(null);
        setSearchQuery('');
        setIsGrouped(false);
        setSortConfig(null);
        setCheckedArticleIds(new Set());
      } catch (err: any) {
        console.error("Import session failed", err);
        alert("Failed to import session. The file might be corrupted.");
      } finally {
        setIsLoading(false);
      }
    };
    input.click();
  };

  const handleSort = (key: string) => {
    setSortConfig(current => {
      if (current?.key === key) {
        return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'asc' };
    });
  };

  const filteredArticles = useMemo(() => {
    let list = articles;

    // Filter by Source (including nested sources)
    if (activeSourceId) {
        // Find all descendant source IDs
        const descendants = new Set<string>([activeSourceId as string]);
        const addDescendants = (parentId: string) => {
            const children = sources.filter(s => s.parentId === parentId);
            children.forEach(c => {
                descendants.add(c.id);
                addDescendants(c.id);
            });
        };
        addDescendants(activeSourceId);
        
        list = list.filter(a => descendants.has(a.sourceId));
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(a => {
        const m = a.metadata;
        return (
          a.fileName.toLowerCase().includes(q) ||
          m?.title.toLowerCase().includes(q) ||
          m?.authors.some(auth => auth.toLowerCase().includes(q)) ||
          m?.journal?.toLowerCase().includes(q) ||
          m?.year.includes(q) ||
          m?.keywords.some(k => k.toLowerCase().includes(q)) ||
          m?.categories.some(c => c.toLowerCase().includes(q))
        );
      });
    }

    if (sortConfig) {
      list.sort((a, b) => {
        let valA: string | number = '';
        let valB: string | number = '';

        switch(sortConfig.key) {
          case 'publication':
            valA = (a.metadata?.title || a.fileName).toLowerCase();
            valB = (b.metadata?.title || b.fileName).toLowerCase();
            break;
          case 'authors':
            valA = (a.metadata?.authors?.[0] || '').toLowerCase();
            valB = (b.metadata?.authors?.[0] || '').toLowerCase();
            break;
          case 'journal':
            valA = (a.metadata?.journal || '').toLowerCase();
            valB = (b.metadata?.journal || '').toLowerCase();
            break;
          case 'year':
            const yearA = parseInt(String(a.metadata?.year || '0'), 10);
            const yearB = parseInt(String(b.metadata?.year || '0'), 10);
            valA = isNaN(yearA) ? 0 : yearA;
            valB = isNaN(yearB) ? 0 : yearB;
            break;
        }

        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    } else {
        // Default sort by addedAt desc
        list.sort((a, b) => b.addedAt - a.addedAt);
    }

    return [...list]; // Return new array reference
  }, [articles, activeSourceId, searchQuery, sortConfig, sources]);

  const handleToggleArticle = (id: string) => {
      setCheckedArticleIds(prev => {
          const next = new Set(prev);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          return next;
      });
  };

  const handleToggleAll = (ids: string[]) => {
      setCheckedArticleIds(new Set(ids));
  };

  const handleNotebookButtonClick = () => {
    if (checkedArticleIds.size === 1) {
        const articleId = Array.from(checkedArticleIds)[0];
        handleSetupNote('article', articleId);
    } else {
        setIsNotebookSetupOpen(true);
    }
  };

  const allCategories = useMemo(() => {
      const cats = new Set<string>();
      articles.forEach(a => a.metadata?.categories.forEach(c => cats.add(c)));
      return Array.from(cats).sort();
  }, [articles]);

  const selectedArticle = articles.find(a => a.id === selectedArticleId);

  return (
    <div className="flex h-screen w-screen bg-slate-50 dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100 overflow-hidden transition-colors duration-200">
      
      {/* Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 z-[100] bg-white/80 dark:bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center">
            <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
            <p className="text-lg font-semibold text-slate-700 dark:text-slate-300 animate-pulse">{loadingMessage}</p>
        </div>
      )}

      <Sidebar 
        sources={sources}
        articles={articles}
        notes={notes}
        activeSourceId={activeSourceId}
        onSetActiveSource={setActiveSourceId}
        onOpenAddModal={() => setIsAddSourceModalOpen(true)}
        onOpenGenerateModal={() => setIsGenerateModalOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenNote={(note) => setSelectedNote(note)}
        onDeleteSource={handleDeleteSource}
        isGenerateDisabled={checkedArticleIds.size === 0}
      />

      <ArticleList 
        articles={filteredArticles}
        selectedArticleId={selectedArticleId}
        onSelectArticle={setSelectedArticleId}
        checkedArticleIds={checkedArticleIds}
        onToggleArticle={handleToggleArticle}
        onToggleAll={handleToggleAll}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSaveSession={handleSaveSession}
        onImportSession={handleImportSession}
        onDeleteSelected={handleDeleteSelected}
        isGrouped={isGrouped}
        onToggleGroup={() => setIsGrouped(prev => !prev)}
        sortConfig={sortConfig}
        onSort={handleSort}
      />

      <ArticleDetail 
        article={selectedArticle}
        notes={notes}
        onClose={() => setSelectedArticleId(null)}
        onUpdateMetadata={handleUpdateArticle}
        onEditNote={handleEditNote}
        onOpenNote={(note) => setSelectedNote(note)}
        onDeleteNote={handleDeleteNote}
        onReplacePdf={handleReplacePdf}
      />

      {/* Floating Action Button for Notebook */}
      <button 
        onClick={handleNotebookButtonClick}
        className="fixed bottom-6 right-6 z-[40] p-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-lg transition-transform hover:scale-110 active:scale-95 flex items-center justify-center group"
        title="Open Notebook"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      </button>

      <SettingsModal 
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        currentTheme={theme}
        onThemeChange={setTheme}
      />

      <NotebookModal 
        isOpen={isNotebookSetupOpen}
        onClose={() => setIsNotebookSetupOpen(false)}
        articles={articles}
        categories={allCategories}
        onConfirm={handleSetupNote}
      />

      <AddSourceModal 
        isOpen={isAddSourceModalOpen}
        onClose={() => setIsAddSourceModalOpen(false)}
        onAddSource={handleAddSource}
        onAddPDF={handleAddPDF}
      />

      <GenerateModal 
        isOpen={isGenerateModalOpen}
        onClose={() => setIsGenerateModalOpen(false)}
        onConfirm={handleGenerateConfirm}
      />

      {activeEditorNote && (
        <NotebookEditor 
          isOpen={!!activeEditorNote}
          initialData={activeEditorNote}
          onClose={() => setActiveEditorNote(null)}
          onSave={handleSaveNote}
          isEditing={isEditingNote}
        />
      )}

      <NoteViewerModal 
        note={selectedNote}
        onClose={() => setSelectedNote(null)}
        onUpdateTitle={handleUpdateNoteTitle}
        onDelete={handleDeleteNote}
        onEdit={handleEditNote}
      />

      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        
        body {
          margin: 0;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        }

        /* Custom Scrollbar */
        ::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        ::-webkit-scrollbar-track {
          background: transparent;
        }
        ::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 10px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
        .dark ::-webkit-scrollbar-thumb {
          background: #475569;
        }
        .dark ::-webkit-scrollbar-thumb:hover {
           background: #64748b;
        }
        
        @keyframes fadeInUp {
            from {
                opacity: 0;
                transform: translate3d(0, 20px, 0);
            }
            to {
                opacity: 1;
                transform: translate3d(0, 0, 0);
            }
        }
        .animate-fade-in-up {
            animation: fadeInUp 0.3s ease-out forwards;
        }
      `}} />
    </div>
  );
};

const App = () => (
  <Suspense fallback={<div className="h-screen w-screen flex items-center justify-center bg-slate-50 text-slate-500 italic">Initializing Librarian...</div>}>
    <LibrarianApp />
  </Suspense>
);

const root = createRoot(document.getElementById('root')!);
root.render(<App />);