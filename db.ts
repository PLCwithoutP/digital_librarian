
import { Article, Source, Note } from './types';

const DB_NAME = 'LibrarianDB';
const DB_VERSION = 2; // Incremented version for schema change

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
      if (!db.objectStoreNames.contains('notes')) {
        db.createObjectStore('notes', { keyPath: 'id' });
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
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

export const saveSourceToDB = async (source: Source) => {
  const db = await openDB();
  const tx = db.transaction('sources', 'readwrite');
  tx.objectStore('sources').put(source);
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

export const saveFileToDB = async (id: string, blob: Blob) => {
  const db = await openDB();
  const tx = db.transaction('files', 'readwrite');
  tx.objectStore('files').put({ id, blob });
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

export const saveNoteToDB = async (note: Note) => {
  const db = await openDB();
  const tx = db.transaction('notes', 'readwrite');
  tx.objectStore('notes').put(note);
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

export const getFileFromDB = async (id: string): Promise<Blob | null> => {
  const db = await openDB();
  const tx = db.transaction('files', 'readonly');
  return new Promise((res, rej) => {
    const req = tx.objectStore('files').get(id);
    req.onsuccess = () => res(req.result?.blob || null);
    req.onerror = () => rej(req.error);
  });
};

export const deleteSourceFromDB = async (id: string) => {
  const db = await openDB();
  const tx = db.transaction('sources', 'readwrite');
  const req = tx.objectStore('sources').delete(id);
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    req.onerror = () => reject(req.error);
  });
};

export const deleteArticleFromDB = async (id: string) => {
  const db = await openDB();
  const tx = db.transaction('articles', 'readwrite');
  const req = tx.objectStore('articles').delete(id);
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    req.onerror = () => reject(req.error);
  });
};

export const deleteFileFromDB = async (id: string) => {
  const db = await openDB();
  const tx = db.transaction('files', 'readwrite');
  const req = tx.objectStore('files').delete(id);
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    req.onerror = () => reject(req.error);
  });
};

export const deleteNoteFromDB = async (id: string) => {
  const db = await openDB();
  const tx = db.transaction('notes', 'readwrite');
  const req = tx.objectStore('notes').delete(id);
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    req.onerror = () => reject(req.error);
  });
};

export const getAllData = async (): Promise<{ sources: Source[], articles: Article[], notes: Note[] }> => {
  const db = await openDB();
  const [sources, articles, notes] = await Promise.all([
    new Promise<Source[]>((resolve) => {
      const tx = db.transaction('sources', 'readonly');
      const req = tx.objectStore('sources').getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    }),
    new Promise<Article[]>((resolve) => {
      const tx = db.transaction('articles', 'readonly');
      const req = tx.objectStore('articles').getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    }),
    new Promise<Note[]>((resolve) => {
      if (!db.objectStoreNames.contains('notes')) {
          resolve([]);
          return;
      }
      const tx = db.transaction('notes', 'readonly');
      const req = tx.objectStore('notes').getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    })
  ]);
  return { sources, articles, notes };
};

export const clearDatabase = async () => {
  const db = await openDB();
  const stores = ['articles', 'sources', 'files', 'notes'];
  const existingStores = Array.from(db.objectStoreNames);
  
  const storesToClear = stores.filter(s => existingStores.includes(s));
  if (storesToClear.length === 0) return;

  const tx = db.transaction(storesToClear, 'readwrite');
  storesToClear.forEach(store => tx.objectStore(store).clear());
  
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

export const restoreSession = async (sources: Source[], articles: Article[], notes: Note[]) => {
   const db = await openDB();
   const stores = ['sources', 'articles', 'notes'];
   const tx = db.transaction(stores, 'readwrite');
   
   const sourceStore = tx.objectStore('sources');
   sources.forEach(s => sourceStore.put(s));
   
   const articleStore = tx.objectStore('articles');
   articles.forEach(a => articleStore.put(a));

   const noteStore = tx.objectStore('notes');
   if (notes) {
      notes.forEach(n => noteStore.put(n));
   }
   
   return new Promise<void>((resolve, reject) => {
     tx.oncomplete = () => resolve();
     tx.onerror = () => reject(tx.error);
   });
};
