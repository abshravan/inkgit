/**
 * Browser-only autosave store (IndexedDB). Holds unsaved editor state per
 * article so a closed tab or crash never loses work, without creating Git
 * commits on every keystroke. Failures are swallowed: autosave is best-effort.
 */

const DB_NAME = "inkgit";
const STORE = "drafts";

export interface LocalDraft<T> {
  key: string;
  /** Blob SHA the edits were based on (null for new articles). */
  baseSha: string | null;
  data: T;
  savedAt: string;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: "key" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore<R>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<R>,
): Promise<R | undefined> {
  if (typeof indexedDB === "undefined") return undefined;
  try {
    const db = await openDb();
    return await new Promise<R>((resolve, reject) => {
      const request = fn(db.transaction(STORE, mode).objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    }).finally(() => db.close());
  } catch {
    return undefined;
  }
}

export function loadLocalDraft<T>(key: string): Promise<LocalDraft<T> | undefined> {
  return withStore("readonly", (store) => store.get(key) as IDBRequest<LocalDraft<T>>);
}

export async function saveLocalDraft<T>(draft: LocalDraft<T>): Promise<void> {
  await withStore("readwrite", (store) => store.put(draft));
}

export async function deleteLocalDraft(key: string): Promise<void> {
  await withStore("readwrite", (store) => store.delete(key));
}
