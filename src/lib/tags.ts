// Initial thesis-tag taxonomy (spec §13). Stored as rows in `tags` so the
// user can add custom ones later (spec §41) without a schema change.
//
// Oriented around mainstream/pop-media story types (per the project brief),
// not financial-analyst categories — the old list included tags like
// Earnings/Guidance/Analyst/Accounting/Macro that fit a financial-press
// scanner, which this app deliberately isn't (see SPEC-NOTES.md "Discovery
// universe"). seed.ts only ever ADDS tags that don't already exist, so
// re-running it after this change is safe — nothing you've already used
// gets removed or renamed.
export const INITIAL_TAGS = [
  "Executive / Leadership Controversy",
  "Cancel Culture / Backlash",
  "Product Failure or Recall",
  "Data Breach / Security Incident",
  "Regulatory / Legal Trouble",
  "Viral Misinformation / Out of Context",
  "Reputation",
  "Political",
  "Competition",
  "Other",
];
