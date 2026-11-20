/**
 * IndexedDB persistence for client-side search indexes (see issue #418).
 *
 * We persist the raw indexed documents (plus, for local files, the picked
 * directory handle) rather than a serialised Orama database — rebuilding the
 * Orama index from documents is fast, and file handles are structured-
 * cloneable so IndexedDB stores them natively where JSON cannot.
 *
 * Every operation is best-effort: failures log to the console and behave as
 * "nothing persisted". A fresh session can never be broken by this module.
 */

const DATABASE_NAME = "mpc-autofill-client-search";
const STORE_NAME = "indexes";
const SCHEMA_VERSION = 1;

export type PersistedSourceType = "localFiles" | "googleDrive";

export interface PersistedIndex {
  documents: Array<unknown>;
  indexedAt: number;
  directoryHandle?: FileSystemDirectoryHandle;
}

interface StoredEntry extends PersistedIndex {
  schemaVersion: number;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function savePersistedIndex(
  sourceType: PersistedSourceType,
  entry: PersistedIndex,
  options?: { schemaVersion?: number }
): Promise<void> {
  try {
    const db = await openDatabase();
    const stored: StoredEntry = {
      ...entry,
      schemaVersion: options?.schemaVersion ?? SCHEMA_VERSION,
    };
    await requestToPromise(
      db
        .transaction(STORE_NAME, "readwrite")
        .objectStore(STORE_NAME)
        .put(stored, sourceType)
    );
    db.close();
  } catch (error) {
    console.warn("Failed to persist client search index:", error);
  }
}

export async function loadPersistedIndex(
  sourceType: PersistedSourceType
): Promise<PersistedIndex | undefined> {
  try {
    const db = await openDatabase();
    const stored: StoredEntry | undefined = await requestToPromise(
      db.transaction(STORE_NAME).objectStore(STORE_NAME).get(sourceType)
    );
    db.close();
    if (stored === undefined) {
      return undefined;
    }
    if (
      stored.schemaVersion !== SCHEMA_VERSION ||
      !Array.isArray(stored.documents)
    ) {
      await clearPersistedIndex(sourceType);
      return undefined;
    }
    const { schemaVersion, ...entry } = stored;
    return entry;
  } catch (error) {
    console.warn("Failed to load persisted client search index:", error);
    return undefined;
  }
}

export async function clearPersistedIndex(
  sourceType: PersistedSourceType
): Promise<void> {
  try {
    const db = await openDatabase();
    await requestToPromise(
      db
        .transaction(STORE_NAME, "readwrite")
        .objectStore(STORE_NAME)
        .delete(sourceType)
    );
    db.close();
  } catch (error) {
    console.warn("Failed to clear persisted client search index:", error);
  }
}
