// Financial vs. general-public media classification (spec §7).
//
// This list is inherently incomplete and editorial by nature — it exists so
// the app can *show* a financial/general split, not to make a definitive
// claim about any outlet. Unknown outlets default to "general" (the more
// conservative choice: we'd rather undercount financial-ecosystem
// containment than overstate it) and are never marked "major" unless listed.

const FINANCIAL_OUTLETS = new Set(
  [
    "Reuters", "Bloomberg", "CNBC", "The Wall Street Journal", "WSJ",
    "Barron's", "MarketWatch", "Financial Times", "Yahoo Finance",
    "Benzinga", "Motley Fool", "Seeking Alpha", "Investor's Business Daily",
    "IBD", "TheStreet", "Investopedia", "Morningstar", "Zacks",
    "Business Insider", "Forbes", "Fortune", "Axios", "Quartz",
    "Institutional Investor", "Pensions & Investments",
  ].map((s) => s.toLowerCase())
);

const MAJOR_OUTLETS = new Set(
  [
    "Reuters", "Bloomberg", "CNBC", "The Wall Street Journal", "WSJ",
    "Associated Press", "AP", "The New York Times", "The Washington Post",
    "BBC", "CNN", "NBC News", "ABC News", "CBS News", "USA Today",
    "Financial Times", "Barron's", "Forbes", "Fortune", "Axios",
    "Politico", "The Guardian",
  ].map((s) => s.toLowerCase())
);

export function isFinancialOutlet(sourceName: string): boolean {
  return FINANCIAL_OUTLETS.has(sourceName.trim().toLowerCase());
}

export function isMajorOutlet(sourceName: string): boolean {
  return MAJOR_OUTLETS.has(sourceName.trim().toLowerCase());
}
