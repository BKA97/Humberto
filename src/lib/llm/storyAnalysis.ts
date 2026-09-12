import { Observation, observed, unavailable } from "../providers/types";

// "Mainstream reach" classification — the AI judgment call described in the
// project brief's "mainstream filter" (Part 1): is this the kind of story a
// person who doesn't follow markets or business news would plausibly have
// heard of? That is a DESCRIPTIVE classification, same category as
// isFinancialOutlet()/isMajorOutlet() — it is NOT, and must never become, a
// judgment about whether a stock's reaction to the story is justified or an
// "overreaction." That line stays the user's own call on each tracked
// position (see positions.thesis) and the Research page's purely
// descriptive historical stats — this module never sees or touches either.
//
// Deliberately does NOT use live web search: the classification works off
// the article text itself (which is the actual thing that reached whatever
// audience it reached), not a live check of current buzz. That keeps this
// cheap and simple for a first version — see README "Known V1 limitations"
// for the tradeoff if you want to add it later.

const DEFAULT_MODEL = "claude-haiku-4-5-20251001";
const API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

export interface StoryAnalysis {
  mainstreamReachScore: number; // 0-100
  rationale: string;
  companies: { name: string }[];
  people: { name: string; likelyCompany?: string }[];
}

interface AnthropicToolUseBlock {
  type: "tool_use";
  input: {
    mainstream_reach_score: number;
    rationale: string;
    companies?: { name: string }[];
    people?: { name: string; likely_company?: string | null }[];
  };
}

const ANALYSIS_TOOL = {
  name: "report_story_analysis",
  description: "Report a structured analysis of this news story.",
  input_schema: {
    type: "object" as const,
    properties: {
      mainstream_reach_score: {
        type: "integer",
        minimum: 0,
        maximum: 100,
        description:
          "0-100: how likely someone who does NOT follow markets or business news would have heard of this story. 0 = purely a financial/trade-press story with no mainstream awareness. 100 = it's genuinely everywhere (major TV news, trending online, the kind of thing that comes up in ordinary conversation).",
      },
      rationale: {
        type: "string",
        description: "One or two plain sentences explaining the score.",
      },
      companies: {
        type: "array",
        description: "Public companies this story is substantively about (by name, not ticker).",
        items: {
          type: "object",
          properties: { name: { type: "string" } },
          required: ["name"],
        },
      },
      people: {
        type: "array",
        description:
          "Named people central to the story (executives, founders, public figures) and, if confidently known, the public company most associated with them.",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            likely_company: { type: ["string", "null"], description: "The company this person is most associated with, if any and if confident." },
          },
          required: ["name"],
        },
      },
    },
    required: ["mainstream_reach_score", "rationale", "companies", "people"],
  },
};

/**
 * Classifies a single story's mainstream reach and extracts the people/
 * companies it's about. Deterministic ticker resolution happens in the
 * caller (see ingestDiscoveryCycle in ../ingest/news.ts) via the real
 * symbol directory — this function only extracts NAMES from text, it never
 * invents or confirms a ticker itself (LLMs can and do hallucinate ticker
 * symbols, so those are never trusted directly).
 */
export async function analyzeStoryMainstreamReach(opts: {
  headline: string;
  summary?: string | null;
}): Promise<Observation<StoryAnalysis>> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return unavailable("ANTHROPIC_API_KEY not configured");

  const model = process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;
  const prompt = [
    "Read this news story and analyze it.",
    "",
    `Headline: ${opts.headline}`,
    opts.summary ? `Summary: ${opts.summary}` : "(no summary available — work from the headline alone)",
    "",
    'For mainstream_reach_score, use this test: "Would an ordinary person who does not follow markets or business news plausibly have heard about this?" Score low for stories that only circulate in financial/trade press or niche business coverage, even if that coverage is heavy. Score high for stories that have genuinely broken into general public awareness (major TV/online news, viral moments, the kind of thing people bring up in casual conversation) — regardless of whether the underlying business impact is large or small.',
  ].join("\n");

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 512,
        tools: [ANALYSIS_TOOL],
        tool_choice: { type: "tool", name: "report_story_analysis" },
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) {
      if (res.status === 429) return unavailable("Anthropic API rate/quota limit reached");
      const body = await res.text().catch(() => "");
      return unavailable(`Anthropic API request failed (HTTP ${res.status}): ${body.slice(0, 200)}`);
    }

    const data: { content?: unknown[] } = await res.json();
    const toolUse = (data.content ?? []).find(
      (block): block is AnthropicToolUseBlock =>
        typeof block === "object" && block !== null && (block as { type?: string }).type === "tool_use"
    );
    if (!toolUse) return unavailable("Anthropic response contained no tool_use block");

    const input = toolUse.input;
    const analysis: StoryAnalysis = {
      mainstreamReachScore: Math.max(0, Math.min(100, Math.round(input.mainstream_reach_score))),
      rationale: input.rationale,
      companies: (input.companies ?? []).filter((c) => c?.name),
      people: (input.people ?? [])
        .filter((p) => p?.name)
        .map((p) => ({ name: p.name, likelyCompany: p.likely_company ?? undefined })),
    };
    return observed(analysis, { source: "anthropic", isEstimate: false, method: model });
  } catch (err) {
    return unavailable(`Anthropic API request error: ${(err as Error).message}`);
  }
}
