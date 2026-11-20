import { create, insertMultiple } from "@orama/orama";

import { OramaCardDocument, OramaIndex, OramaSchema } from "@/common/types";

/**
 * Build a searchable Orama index from card documents. Used both when indexing
 * from scratch and when restoring persisted documents from IndexedDB.
 */
export function buildOramaIndex(
  documents: Array<OramaCardDocument>
): OramaIndex {
  const db = create({
    schema: OramaSchema,
    sort: {
      enabled: true,
      unsortableProperties: [
        // every field on OramaCardDocument except `searchq` and `lastModifiedNumber` :)
        "name",
        "source",
        "sourceId",
        "sourceVerbose",
        "cardType",
        "extension",
        "language",
        "tags",
        "dpi",
        "size",
        "id",
        "lastModified",
        "params",
      ],
    },
  });
  insertMultiple(db, documents);
  return { oramaDb: db, size: documents.length };
}
