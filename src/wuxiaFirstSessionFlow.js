import {
  createChapterSession,
  summarizeChapterSessionContract,
} from "./chapterSession.js";

/**
 * Backward-compatible factory kept while browser, persistence and test callers
 * migrate to the ChapterSession domain boundary.
 */
export function createFirstSessionRuntime(contract, options = {}) {
  return createChapterSession(contract, options);
}

/**
 * Backward-compatible summary name for existing diagnostics.
 */
export function summarizeFirstSessionContract(contract) {
  return summarizeChapterSessionContract(contract);
}
