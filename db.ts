
import { Article, Source } from './types';

const DB_NAME = 'LibrarianDB';
const DB_VERSION = 1;

export const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('articles')) {
        db.createObjectStore('articles', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('sources')) {
        db.createObjectStore('sources', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('files')) {
        db.createObjectStore('files', { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const saveArticleToDB = async (article: Article) => {
  const db = await openDB();
  const tx = db.transaction('articles', 'readwrite');
  tx.objectStore('articles').put(article);
};

export const saveSourceToDB = async (source: Source) => {
  const db = await openDB();
  const tx = db.transaction('sources', 'readwrite');
  tx.objectStore('sources').put(source);
};

export const saveFileToDB = async (id: string, blob: Blob) => {
  const db = await openDB();
  const tx = db.transaction('files', 'readwrite');
  tx.objectStore('files').put({ id, blob });
};

export const getFileFromDB = async (id: string): Promise<Blob | null> => {
  const db = await openDB();
  const tx = db.transaction('files', 'readonly');
  return new Promise((res) => {
    const req = tx.objectStore('files').get(id);
    req.onsuccess = () => res(req.result?.blob || null);
  });
};

export const deleteSourceFromDB = async (id: string) => {
  const db = await openDB();
  const tx = db.transaction('sources', 'readwrite');
  tx.objectStore('sources').delete(id);
};

export const deleteArticleFromDB = async (id: string) => {
  const db = await openDB();
  const tx = db.transaction('articles', 'readwrite');
  tx.objectStore('articles').delete(id);
};

export const deleteFileFromDB = async (id: string) => {
  const db = await openDB();
  const tx = db.transaction('files', 'readwrite');
  tx.objectStore('files').delete(id);
};

export const getAllData = async (): Promise<{ sources: Source[], articles: Article[] }> => {
  const db = await openDB();
  const [sources, articles] = await Promise.all([
    new Promise<Source[]>((resolve) => {
      const tx = db.transaction('sources', 'readonly');
      const req = tx.objectStore('sources').getAll();
      req.onsuccess = () => resolve(req.result);
    }),
    new Promise<Article[]>((resolve) => {
      const tx = db.transaction('articles', 'readonly');
      const req = tx.objectStore('articles').getAll();
      req.onsuccess = () => resolve(req.result);
    })
  ]);
  return { sources, articles };
};
