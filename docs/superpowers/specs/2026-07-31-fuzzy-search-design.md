# Fuzzy Search Fallback — Design

**Date:** 2026-07-31
**Status:** Approved pending review

## Problem

Card search fails outright when the query doesn't exactly match a card name. The
existing "Fuzzy (Forgiving) Search" toggle (default: off/precise) only switches
between whole-string matching and word-level matching with a hard AND — there is
no typo tolerance anywhere, and extra words (e.g. "the lightning bolt") cause
zero results even in forgiving mode.

Failure kinds in scope: typos/misspellings, partial names, punctuation/accents,
word order/extra words. (Punctuation, accents, and word order are already mostly
handled by `to_searchable` sanitization and the ES analyzers; typos, extra
words, and precise-mode misses are the gaps this design closes.)

## Chosen approach: retry-on-miss ("exact first, fuzzy fallback")

Existing queries are untouched. When a search returns **zero** hits and a query
string is present, retry in a more forgiving mode (one retry on the client;
up to two escalating retries on the backend). If the primary
search finds one or more results, behavior is byte-for-byte identical to today.
The fallback fires in both precise and forgiving modes (the toggle defaults to
precise, so a fuzzy-mode-only fallback would leave the default experience
broken).

Rejected alternatives:
- **Blended single query with boosting** — fuzzy candidates always pollute
  results; hard to keep the two stacks consistent.
- **Index-time n-gram/phonetic fields** — requires ES schema migration + full
  reindex, has no client-side (Orama) equivalent, overkill for card-name-length
  strings.

## Components

### Client search (Orama) — `frontend/src/features/clientSearch/clientSearchService.worker.ts`

`searchOramaIndex` is the single shared search routine (both `editorSearch` and
`exploreSearch` call it). Add the retry there:

- Condition: initial search returns 0 hits AND `query` is defined/non-empty.
- Retry parameters: `exact: false`, `tolerance: 2` (Orama Levenshtein edit
  distance).
- All `where` filters (card type, source, tags, DPI, size, printings, artists)
  remain applied on the retry — fuzzy rescues bad spelling, never bypasses
  filters.

### Backend (Elasticsearch) — `MPCAutofill/cardpicker/search/search_functions.py`

The match clause builder gets fallback variants, executed from the shared
retrieval function (so editor and explore endpoints both benefit) only when the
primary search returns 0 hits:

1. First retry: `Match(searchq_fuzzy={"query": q, "operator": "AND",
   "fuzziness": "AUTO"})` — typo tolerance, all words still required.
2. Second retry (only if the first retry also returns 0):
   same, with `minimum_should_match: "75%"` replacing the AND operator —
   tolerates extra words.

All existing filters (source, DPI, size, card type, language, tags) remain on
the fallback queries. No index mapping changes, no reindex.

## Data flow

Unchanged. No API schema changes; request/response shapes are untouched. The
fallback is invisible to callers except that previously-empty result sets may
now contain matches.

## Error handling

The fallback is best-effort: if a retry throws (ES timeout, worker error), we
return the original empty result set rather than surfacing a new error path.

## Testing

- **Client (Jest, worker tests):**
  - typo query: "lightnig bolt" → finds "Lightning Bolt"
  - extra words: "the lightning bolt" → finds "Lightning Bolt"
  - partial: "bolt" → finds "Lightning Bolt"
  - guard: a query with exact hits returns identical results with the feature
    in place
  - filters still apply during fallback (e.g. excluded tag stays excluded)
- **Backend (pytest against real ES, existing `cardpicker/tests/` patterns):**
  same five cases.

## Dev infrastructure

Bring up Postgres + Elasticsearch + Django locally via the repo's `docker/`
compose files, seeded with a small test drive, to exercise the backend
end-to-end.
