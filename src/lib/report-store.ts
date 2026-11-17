/** Keeps imported reports and grading progress in this browser (IndexedDB) so a refresh loses nothing. */
import type { GradeItem } from "./grading";

export interface StoredReport {
  id: string;
  fileName: string;
  buffer: ArrayBuffer;
  addedAt: number;
  grading?: { items: GradeItem[]; comment: string; written: boolean };
}

const DB = "grading-desk";
const STORE = "reports";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "id" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const req = fn(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export const loadReports = () => run<StoredReport[]>("readonly", (s) => s.getAll() as IDBRequest<StoredReport[]>);
export const saveReport = (r: StoredReport) => run("readwrite", (s) => s.put(r));
export const deleteReport = (id: string) => run("readwrite", (s) => s.delete(id));
export const clearReports = () => run("readwrite", (s) => s.clear());
