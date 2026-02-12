
import { Article, Source, Note } from './types';

// Database functionality removed as per request. 
// Persistence is now handled via librarian_session.json.

export const openDB = async () => ({});
export const saveArticleToDB = async (article: Article) => {};
export const saveSourceToDB = async (source: Source) => {};
export const saveFileToDB = async (id: string, blob: Blob) => {};
export const saveNoteToDB = async (note: Note) => {};
export const getFileFromDB = async (id: string) => null;
export const deleteSourceFromDB = async (id: string) => {};
export const deleteArticleFromDB = async (id: string) => {};
export const deleteFileFromDB = async (id: string) => {};
export const deleteNoteFromDB = async (id: string) => {};
export const getAllData = async () => ({ sources: [], articles: [], notes: [] });
export const clearDatabase = async () => {};
export const restoreSession = async (sources: Source[], articles: Article[], notes: Note[]) => {};
