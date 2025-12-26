
export interface ArticleMetadata {
  title: string;
  authors: string[];
  year: string;
  categories: string[];
  keywords: string[];
  abstract: string;
  type?: string;
}

export interface Article {
  id: string;
  sourceId: string;
  fileName: string;
  fileSize: number;
  addedAt: number;
  metadata?: ArticleMetadata;
  status: 'pending' | 'processing' | 'completed' | 'error';
}

export interface Source {
  id: string;
  name: string;
  path?: string;
}