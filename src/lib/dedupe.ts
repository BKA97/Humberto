// Syndicated-copy detection (spec §9): "Do not simply count syndicated
// copies of the same story as separate independent news events." This is a
// heuristic, not a guarantee — it exists to make "unique reporting" vs.
// "syndicated coverage" a visible, roughly-right distinction rather than
// silently counting every wire reprint as independent attention.

export interface DedupeInput {
  headline: string;
  url: string;
  publishedAt: string | null;
}

export interface DedupeResult {
  /** true if this article is judged a re-run of an earlier one in the batch */
  isDuplicate: boolean;
  /** index (into the original input array) of the earliest matching article, if any */
  originalIndex: number | null;
}

function normalize(headline: string): string {
  return headline
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function wordSet(headline: string): Set<string> {
  return new Set(normalize(headline).split(" ").filter((w) => w.length > 2));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const w of a) if (b.has(w)) intersection++;
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

const SIMILARITY_THRESHOLD = 0.82;

export function detectSyndication(articles: DedupeInput[]): DedupeResult[] {
  const order = articles
    .map((a, index) => ({ index, publishedAt: a.publishedAt ? new Date(a.publishedAt).getTime() : Infinity }))
    .sort((a, b) => a.publishedAt - b.publishedAt);

  const results: DedupeResult[] = articles.map(() => ({ isDuplicate: false, originalIndex: null }));
  const originals: { index: number; url: string; words: Set<string> }[] = [];

  for (const { index } of order) {
    const article = articles[index];
    const sameUrl = originals.find((o) => o.url === article.url);
    if (sameUrl) {
      results[index] = { isDuplicate: true, originalIndex: sameUrl.index };
      continue;
    }
    const words = wordSet(article.headline);
    const match = originals.find((o) => jaccard(o.words, words) >= SIMILARITY_THRESHOLD);
    if (match) {
      results[index] = { isDuplicate: true, originalIndex: match.index };
    } else {
      originals.push({ index, url: article.url, words });
    }
  }
  return results;
}

/** Convenience: counts for a card's "News attention" block. */
export function summarizeCoverage(articles: { source: string; isSyndicatedCopyOf: string | null }[]) {
  const uniqueArticles = articles.filter((a) => !a.isSyndicatedCopyOf);
  const uniqueOutlets = new Set(uniqueArticles.map((a) => a.source));
  return {
    totalArticles: articles.length,
    uniqueArticles: uniqueArticles.length,
    uniqueOutlets: uniqueOutlets.size,
  };
}
