
export interface ArticleMetadata {
  title: string;
  authors: string[];
  journal?: string;
  volume?: string;
  number?: string | number | null; // Issue number
  pages?: string; // pp.
  year: string;
  doi?: string;
  url?: string;
  categories: string[];
  keywords: string[];
  abstract: string;
  bibtex?: string;
}

export interface Article {
  id: string;
  sourceId: string;
  fileName: string;
  filePath?: string; // Relative path from upload
  fileSize: number;
  addedAt: number;
  metadata?: ArticleMetadata;
  status: 'pending' | 'processing' | 'completed' | 'error';
}

export interface Source {
  id: string;
  name: string;
  path?: string;
  parentId?: string; // For nested folders
}

export type NoteType = 'article' | 'general' | 'category';

export interface Note {
  id: string;
  title: string;
  type: NoteType;
  targetId?: string; // Article ID or Category Name
  content: string; // Markdown
  createdAt: number;
}
