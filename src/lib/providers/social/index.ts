import { AttentionPlatform, SocialAttentionProvider } from "../types";
import { RedditAttentionProvider } from "./reddit";
import { YouTubeAttentionProvider } from "./youtube";
import { GdeltAttentionProvider } from "./gdelt";
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

/**
 * One provider per public-attention platform (spec §8: X, Reddit, TikTok,
 * Instagram, YouTube, plus GDELT as a global-news-volume signal).
 *
 * `includeLowFrequencyProviders` (default true) lets a caller skip GDELT
 * specifically — it's the one provider here with real rate-limit fragility
 * (see gdelt.ts), so frequent intraday polling passes false to only query
 * it once a day via the Morning Brief. Every other provider is included
 * regardless, since they don't share that concern.
 */
export function getSocialProviders(opts?: { includeLowFrequencyProviders?: boolean }): SocialAttentionProvider[] {
  const includeLowFrequency = opts?.includeLowFrequencyProviders ?? true;
  const providers: SocialAttentionProvider[] = [
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
  // GDELT needs no API key (it's free/keyless), so it's opted into with a
  // plain on/off flag rather than the "is a key configured" pattern used
  // everywhere else — see README for why it defaults off.
  if (process.env.ENABLE_GDELT === "true" && includeLowFrequency) {
    providers.push(new GdeltAttentionProvider());
  }
  return providers;
}

export function isUsingAnyMockSocial(): boolean {
  return DEV_FALLBACK_TO_MOCK;
}
