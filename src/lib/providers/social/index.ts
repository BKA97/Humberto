import { AttentionPlatform, SocialAttentionProvider } from "../types";
import { RedditAttentionProvider } from "./reddit";
import { YouTubeAttentionProvider } from "./youtube";
import { MockSocialAttentionProvider } from "./mock";
import {
  UnavailableSocialAttentionProvider,
  X_UNAVAILABLE_REASON,
  TIKTOK_UNAVAILABLE_REASON,
  INSTAGRAM_UNAVAILABLE_REASON,
} from "./unavailable";

// Mock data is only ever a development convenience (spec §44) — production
// shows real data where a provider is configured and "Not available"
// everywhere else, never synthetic numbers standing in for real ones.
const DEV_FALLBACK_TO_MOCK = process.env.NODE_ENV !== "production";

function mockOrUnavailable(platform: AttentionPlatform, reason: string): SocialAttentionProvider {
  return DEV_FALLBACK_TO_MOCK
    ? new MockSocialAttentionProvider(platform)
    : new UnavailableSocialAttentionProvider(platform, reason);
}

/** One provider per public-attention platform (spec §8: X, Reddit, TikTok, Instagram, YouTube). */
export function getSocialProviders(): SocialAttentionProvider[] {
  return [
    process.env.REDDIT_CLIENT_ID && process.env.REDDIT_CLIENT_SECRET
      ? new RedditAttentionProvider(
          process.env.REDDIT_CLIENT_ID,
          process.env.REDDIT_CLIENT_SECRET,
          process.env.REDDIT_USER_AGENT || "market-reaction-lab/0.1"
        )
      : mockOrUnavailable("REDDIT", "Reddit API credentials not configured."),
    process.env.YOUTUBE_API_KEY
      ? new YouTubeAttentionProvider(process.env.YOUTUBE_API_KEY)
      : mockOrUnavailable("YOUTUBE", "YouTube API key not configured."),
    // No real integration exists yet for these three at any configuration —
    // see providers/social/unavailable.ts for why.
    mockOrUnavailable("X", X_UNAVAILABLE_REASON),
    mockOrUnavailable("TIKTOK", TIKTOK_UNAVAILABLE_REASON),
    mockOrUnavailable("INSTAGRAM", INSTAGRAM_UNAVAILABLE_REASON),
  ];
}

export function isUsingAnyMockSocial(): boolean {
  return DEV_FALLBACK_TO_MOCK;
}
