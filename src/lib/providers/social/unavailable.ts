import { SocialAttentionProvider, AttentionPlatform, unavailable } from "../types";

/**
 * Stub for a platform with no practical no-cost public-search API for a
 * personal project (spec §33 rules out fabricating precision — this is the
 * honest alternative). Keeps the provider slot wired into the rest of the
 * app so it's a drop-in swap the day a real integration becomes available.
 */
export class UnavailableSocialAttentionProvider implements SocialAttentionProvider {
  name = "unavailable";
  constructor(public platform: AttentionPlatform, private reason: string) {}

  async getAttention() {
    return unavailable(this.reason);
  }
}

export const X_UNAVAILABLE_REASON =
  "X (Twitter) search access requires a paid API tier (Basic, ~$200/mo or higher) — not configured.";
export const TIKTOK_UNAVAILABLE_REASON =
  "TikTok has no self-serve public-search API suitable for a personal project — not configured.";
export const INSTAGRAM_UNAVAILABLE_REASON =
  "Instagram's Graph API does not support public keyword search outside owned business accounts — not configured.";
