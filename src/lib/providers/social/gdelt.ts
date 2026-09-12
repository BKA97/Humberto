import { SocialAttentionProvider, AttentionMetric, observed, unavailable } from "../types";

// GDELT's DOC 2.0 API (https://api.gdeltproject.org) — a free, keyless,
// global news-coverage index. Used here purely as an additional
// general-public COVERAGE VOLUME signal (how many articles worldwide
// mentioned this company in the last day), never for its "tone" field —
// this app was deliberately built to show attention/volume, not sentiment
// (spec §8), and that choice stands even though GDELT would make sentiment
// easy to bolt on. If you ever want to reconsider that, the tone field is
// simply never requested/parsed below — nothing to strip out later, it was
// never brought in.
//
// Honest caveat (see README/SPEC-NOTES): GDELT is a free research/academic
// resource, not a commercial SLA'd API. It's noticeably more prone to rate
// limiting and to returning a plain-text error with an HTTP 200 status
// (instead of JSON) than every other provider in this app. Both are handled
// defensively below by treating anything that isn't valid, well-formed JSON
// as `unavailable` rather than throwing — an occasional "Not available"
// from this one provider is expected behavior, not a bug to chase.

const BASE = "https://api.gdeltproject.org/api/v2/doc/doc";
const MAX_RECORDS = 250; // GDELT's own hard cap per query — see the isEstimate note below

interface GdeltArticle {
  url?: string;
  domain?: string;
  title?: string;
}

export class GdeltAttentionProvider implements SocialAttentionProvider {
  name = "gdelt";
  platform = "GDELT" as const;

  async getAttention(query: { ticker: string; companyName: string }) {
    try {
      const params = new URLSearchParams({
        query: `"${query.companyName}" sourcelang:eng`,
        mode: "artlist",
        format: "json",
        timespan: "1d",
        maxrecords: String(MAX_RECORDS),
        sort: "hybridrel",
      });
      const res = await fetch(`${BASE}?${params.toString()}`, { cache: "no-store" });
      if (!res.ok) return unavailable(`GDELT request failed (HTTP ${res.status})`);

      const text = await res.text();
      let data: { articles?: GdeltArticle[] };
      try {
        data = JSON.parse(text);
      } catch {
        // GDELT reports its own errors as plain text with a 200 status
        // (e.g. rate limiting, malformed query) rather than JSON — this is
        // the expected shape of that failure mode, not a parsing bug.
        return unavailable(`GDELT returned a non-JSON response: ${text.slice(0, 150)}`);
      }

      const articles = data.articles ?? [];
      const uniqueDomains = new Set(articles.map((a) => a.domain).filter(Boolean)).size;
      const isEstimate = articles.length >= MAX_RECORDS;

      const metrics: AttentionMetric[] = [
        { metricLabel: "global news mentions (24h)", value: articles.length, ecosystem: "GENERAL_PUBLIC" },
        { metricLabel: "distinct outlets covering it (24h)", value: uniqueDomains, ecosystem: "GENERAL_PUBLIC" },
      ];
      return observed(metrics, {
        source: "gdelt",
        isEstimate,
        method: isEstimate ? `capped at ${MAX_RECORDS} results — true count may be higher` : undefined,
      });
    } catch (err) {
      return unavailable(`GDELT request error: ${(err as Error).message}`);
    }
  }
}
