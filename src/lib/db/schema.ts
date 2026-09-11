// Market Reaction Lab — data model (Drizzle ORM / Postgres)
//
// Guiding rule (spec §31/§32): observations are append-only. We snapshot
// market reactions and attention over time rather than overwriting a single
// row, and every external measurement carries its source, timestamps, and
// whether it's exact or estimated. Positions preserve the exact state of the
// world at entry, forever, even as later research/context changes.

import {
  pgTable,
  pgEnum,
  text,
  timestamp,
  doublePrecision,
  boolean,
  integer,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";

const id = () => text("id").primaryKey().$defaultFn(() => createId());

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const marketSessionEnum = pgEnum("market_session", [
  "PREVIOUS_CLOSE",
  "PRE_MARKET",
  "OPEN",
  "INTRADAY",
  "CLOSE",
  "AFTER_HOURS",
]);

export const attentionEcosystemEnum = pgEnum("attention_ecosystem", [
  "FINANCIAL",
  "GENERAL_PUBLIC",
]);

export const attentionPlatformEnum = pgEnum("attention_platform", [
  "NEWS_FINANCIAL",
  "NEWS_GENERAL",
  "X",
  "REDDIT",
  "TIKTOK",
  "INSTAGRAM",
  "YOUTUBE",
]);

export const positionStatusEnum = pgEnum("position_status", ["ACTIVE", "CLOSED"]);

export const alertTypeEnum = pgEnum("alert_type", [
  "PRICE_MOVE",
  "VOLUME_SPIKE",
  "NEWS_ATTENTION_SPIKE",
  "SOCIAL_ATTENTION_SPIKE",
  "NEW_DEVELOPMENT",
  "REGULATORY_FILING",
]);

// ---------------------------------------------------------------------------
// Companies
// ---------------------------------------------------------------------------

export const companies = pgTable(
  "companies",
  {
    id: id(),
    ticker: text("ticker").notNull(),
    name: text("name").notNull(),
    exchange: text("exchange"),
    sector: text("sector"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("companies_ticker_idx").on(t.ticker)]
);

// ---------------------------------------------------------------------------
// News events
// ---------------------------------------------------------------------------

export const newsEvents = pgTable(
  "news_events",
  {
    id: id(),
    headline: text("headline").notNull(),
    summary: text("summary").notNull(),
    category: text("category"),
    firstReportedAt: timestamp("first_reported_at"),
    discoveredAt: timestamp("discovered_at").notNull().defaultNow(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("news_events_first_reported_idx").on(t.firstReportedAt)]
);

export const newsEventCompanies = pgTable(
  "news_event_companies",
  {
    id: id(),
    newsEventId: text("news_event_id").notNull().references(() => newsEvents.id),
    companyId: text("company_id").notNull().references(() => companies.id),
  },
  (t) => [uniqueIndex("nec_event_company_idx").on(t.newsEventId, t.companyId)]
);

export const articles = pgTable(
  "articles",
  {
    id: id(),
    newsEventId: text("news_event_id").notNull().references(() => newsEvents.id),
    source: text("source").notNull(),
    headline: text("headline").notNull(),
    url: text("url").notNull(),
    publishedAt: timestamp("published_at"),
    discoveredAt: timestamp("discovered_at").notNull().defaultNow(),
    isFinancialOutlet: boolean("is_financial_outlet").notNull().default(false),
    isMajorOutlet: boolean("is_major_outlet").notNull().default(false),
    isSyndicatedCopyOf: text("is_syndicated_copy_of"),
    provenanceSource: text("provenance_source").notNull(),
    retrievedAt: timestamp("retrieved_at").notNull().defaultNow(),
  },
  (t) => [index("articles_event_idx").on(t.newsEventId), index("articles_url_idx").on(t.url)]
);

// ---------------------------------------------------------------------------
// Market data
// ---------------------------------------------------------------------------

export const marketSnapshots = pgTable(
  "market_snapshots",
  {
    id: id(),
    companyId: text("company_id").notNull().references(() => companies.id),
    newsEventId: text("news_event_id").references(() => newsEvents.id),
    session: marketSessionEnum("session").notNull(),
    price: doublePrecision("price").notNull(),
    previousClose: doublePrecision("previous_close"),
    dollarChange: doublePrecision("dollar_change"),
    percentChange: doublePrecision("percent_change"),
    volume: doublePrecision("volume"),
    averageVolume: doublePrecision("average_volume"),
    relativeVolume: doublePrecision("relative_volume"),
    observedAt: timestamp("observed_at").notNull(),
    retrievedAt: timestamp("retrieved_at").notNull().defaultNow(),
    source: text("source").notNull(),
    isEstimate: boolean("is_estimate").notNull().default(false),
  },
  (t) => [
    index("market_snapshots_company_time_idx").on(t.companyId, t.observedAt),
    index("market_snapshots_event_idx").on(t.newsEventId),
  ]
);

// ---------------------------------------------------------------------------
// Attention
// ---------------------------------------------------------------------------

export const attentionSnapshots = pgTable(
  "attention_snapshots",
  {
    id: id(),
    companyId: text("company_id").references(() => companies.id),
    newsEventId: text("news_event_id").references(() => newsEvents.id),
    platform: attentionPlatformEnum("platform").notNull(),
    ecosystem: attentionEcosystemEnum("ecosystem").notNull(),
    metricLabel: text("metric_label").notNull(),
    value: doublePrecision("value"),
    isAvailable: boolean("is_available").notNull().default(true),
    isEstimate: boolean("is_estimate").notNull().default(false),
    baselineValue: doublePrecision("baseline_value"),
    percentVsBaseline: doublePrecision("percent_vs_baseline"),
    trending: boolean("trending"),
    observedAt: timestamp("observed_at").notNull().defaultNow(),
    retrievedAt: timestamp("retrieved_at").notNull().defaultNow(),
    source: text("source").notNull(),
    method: text("method"),
  },
  (t) => [
    index("attention_company_time_idx").on(t.companyId, t.observedAt),
    index("attention_event_time_idx").on(t.newsEventId, t.observedAt),
    index("attention_platform_idx").on(t.platform),
  ]
);

export const attentionBaselines = pgTable(
  "attention_baselines",
  {
    id: id(),
    companyId: text("company_id").notNull().references(() => companies.id),
    platform: attentionPlatformEnum("platform").notNull(),
    averageValue: doublePrecision("average_value").notNull(),
    sampleCount: integer("sample_count").notNull(),
    windowDays: integer("window_days").notNull().default(30),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("baseline_company_platform_idx").on(t.companyId, t.platform)]
);

// ---------------------------------------------------------------------------
// Positions
// ---------------------------------------------------------------------------

export const positions = pgTable(
  "positions",
  {
    id: id(),
    companyId: text("company_id").notNull().references(() => companies.id),
    newsEventId: text("news_event_id").references(() => newsEvents.id),
    status: positionStatusEnum("status").notNull().default("ACTIVE"),

    entryPrice: doublePrecision("entry_price").notNull(),
    entryTimestamp: timestamp("entry_timestamp").notNull(),
    entrySession: marketSessionEnum("entry_session").notNull(),
    entryBenchmarkLevel: doublePrecision("entry_benchmark_level"),

    originalReactionSnapshotIds: jsonb("original_reaction_snapshot_ids"),
    originalAttentionSnapshotIds: jsonb("original_attention_snapshot_ids"),

    thesis: text("thesis").notNull(),
    reasonNote: text("reason_note"),

    exitPrice: doublePrecision("exit_price"),
    exitTimestamp: timestamp("exit_timestamp"),
    exitSession: marketSessionEnum("exit_session"),
    exitBenchmarkLevel: doublePrecision("exit_benchmark_level"),

    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("positions_status_idx").on(t.status), index("positions_company_idx").on(t.companyId)]
);

export const tags = pgTable(
  "tags",
  {
    id: id(),
    name: text("name").notNull(),
    isCustom: boolean("is_custom").notNull().default(false),
  },
  (t) => [uniqueIndex("tags_name_idx").on(t.name)]
);

export const positionTags = pgTable(
  "position_tags",
  {
    id: id(),
    positionId: text("position_id").notNull().references(() => positions.id),
    tagId: text("tag_id").notNull().references(() => tags.id),
  },
  (t) => [uniqueIndex("position_tags_idx").on(t.positionId, t.tagId)]
);

// ---------------------------------------------------------------------------
// Alerts
// ---------------------------------------------------------------------------

export const alerts = pgTable("alerts", {
  id: id(),
  positionId: text("position_id").notNull().references(() => positions.id),
  type: alertTypeEnum("type").notNull(),
  message: text("message").notNull(),
  data: jsonb("data"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  readAt: timestamp("read_at"),
});

export const alertThresholds = pgTable("alert_thresholds", {
  id: id(),
  priceMovePercent: doublePrecision("price_move_percent").notNull().default(5),
  volumeRelativeMultiple: doublePrecision("volume_relative_multiple").notNull().default(3),
  newsAttentionPercentIncrease: doublePrecision("news_attention_percent_increase").notNull().default(100),
  socialAttentionPercentIncrease: doublePrecision("social_attention_percent_increase").notNull().default(200),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// System / provenance
// ---------------------------------------------------------------------------

export const systemConfig = pgTable("system_config", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const ingestionLogs = pgTable(
  "ingestion_logs",
  {
    id: id(),
    source: text("source").notNull(),
    operation: text("operation").notNull(),
    status: text("status").notNull(),
    detail: text("detail"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("ingestion_logs_source_time_idx").on(t.source, t.createdAt)]
);

// A cached reference list of every US common-stock ticker + name (spec §4:
// discovery should work from the news outward, not from a fixed list of
// tickers). This is what lets an untagged general-news article get matched
// to a company by name/cashtag — it is NOT the set of companies being
// "watched"; see src/lib/companyMatch.ts and src/lib/ingest/news.ts.
export const symbolDirectory = pgTable("symbol_directory", {
  ticker: text("ticker").primaryKey(),
  name: text("name").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Relations (for query API ergonomics)
// ---------------------------------------------------------------------------

export const companiesRelations = relations(companies, ({ many }) => ({
  marketSnapshots: many(marketSnapshots),
  attentionSnapshots: many(attentionSnapshots),
  positions: many(positions),
  eventLinks: many(newsEventCompanies),
}));

export const newsEventsRelations = relations(newsEvents, ({ many }) => ({
  companies: many(newsEventCompanies),
  articles: many(articles),
  attentionSnapshots: many(attentionSnapshots),
  positions: many(positions),
}));

export const newsEventCompaniesRelations = relations(newsEventCompanies, ({ one }) => ({
  newsEvent: one(newsEvents, { fields: [newsEventCompanies.newsEventId], references: [newsEvents.id] }),
  company: one(companies, { fields: [newsEventCompanies.companyId], references: [companies.id] }),
}));

export const articlesRelations = relations(articles, ({ one }) => ({
  newsEvent: one(newsEvents, { fields: [articles.newsEventId], references: [newsEvents.id] }),
}));

export const marketSnapshotsRelations = relations(marketSnapshots, ({ one }) => ({
  company: one(companies, { fields: [marketSnapshots.companyId], references: [companies.id] }),
  newsEvent: one(newsEvents, { fields: [marketSnapshots.newsEventId], references: [newsEvents.id] }),
}));

export const attentionSnapshotsRelations = relations(attentionSnapshots, ({ one }) => ({
  company: one(companies, { fields: [attentionSnapshots.companyId], references: [companies.id] }),
  newsEvent: one(newsEvents, { fields: [attentionSnapshots.newsEventId], references: [newsEvents.id] }),
}));

export const positionsRelations = relations(positions, ({ one, many }) => ({
  company: one(companies, { fields: [positions.companyId], references: [companies.id] }),
  newsEvent: one(newsEvents, { fields: [positions.newsEventId], references: [newsEvents.id] }),
  tags: many(positionTags),
  alerts: many(alerts),
}));

export const positionTagsRelations = relations(positionTags, ({ one }) => ({
  position: one(positions, { fields: [positionTags.positionId], references: [positions.id] }),
  tag: one(tags, { fields: [positionTags.tagId], references: [tags.id] }),
}));

export const tagsRelations = relations(tags, ({ many }) => ({
  positions: many(positionTags),
}));

export const alertsRelations = relations(alerts, ({ one }) => ({
  position: one(positions, { fields: [alerts.positionId], references: [positions.id] }),
}));
