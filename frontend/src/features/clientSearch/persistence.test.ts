import "fake-indexeddb/auto";

import { IDBFactory } from "fake-indexeddb";

import {
  clearPersistedIndex,
  loadPersistedIndex,
  savePersistedIndex,
} from "./persistence";

const buildDocument = (id: string) => ({
  id,
  name: id,
  searchq: id.toLowerCase(),
  sourceId: -1,
  tags: [] as Array<string>,
});

beforeEach(() => {
  // a fresh in-memory IndexedDB per test
  indexedDB = new IDBFactory();
});

describe("client search index persistence", () => {
  test("round-trips a persisted entry", async () => {
    const documents = [buildDocument("Card A"), buildDocument("Card B")];
    await savePersistedIndex("googleDrive", {
      documents,
      indexedAt: 1_700_000_000_000,
    });
    const loaded = await loadPersistedIndex("googleDrive");
    expect(loaded?.indexedAt).toBe(1_700_000_000_000);
    expect(loaded?.documents).toEqual(documents);
  });

  test("returns undefined when nothing was persisted", async () => {
    expect(await loadPersistedIndex("localFiles")).toBeUndefined();
  });

  test("entries are independent per source type", async () => {
    await savePersistedIndex("googleDrive", {
      documents: [buildDocument("Drive Card")],
      indexedAt: 1,
    });
    expect(await loadPersistedIndex("localFiles")).toBeUndefined();
  });

  test("clear removes the entry", async () => {
    await savePersistedIndex("localFiles", {
      documents: [buildDocument("Card A")],
      indexedAt: 1,
    });
    await clearPersistedIndex("localFiles");
    expect(await loadPersistedIndex("localFiles")).toBeUndefined();
  });

  test("an entry with a mismatched schema version loads as undefined and is cleared", async () => {
    // simulate a future/old schema by writing with a different version
    await savePersistedIndex(
      "googleDrive",
      { documents: [buildDocument("Card A")], indexedAt: 1 },
      { schemaVersion: 999 }
    );
    expect(await loadPersistedIndex("googleDrive")).toBeUndefined();
  });

  test("load failures degrade to undefined rather than throwing", async () => {
    // break indexedDB entirely
    // @ts-expect-error - deliberately clobbering the global to simulate storage failure
    globalThis.indexedDB = undefined;
    await expect(loadPersistedIndex("googleDrive")).resolves.toBeUndefined();
    await expect(
      savePersistedIndex("googleDrive", { documents: [], indexedAt: 1 })
    ).resolves.toBeUndefined();
  });
});
