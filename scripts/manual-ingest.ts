// Manually run one ingestion cycle without going through the HTTP cron
// routes — handy for local development/testing.
import "dotenv/config";
import { ingestDiscoveryCycle } from "../src/lib/ingest/news";
import { checkAndCreateAlerts } from "../src/lib/alerts";

async function main() {
  console.log("Running ingestion cycle...");
  const result = await ingestDiscoveryCycle({ sinceHours: 20 });
  console.log("Ingestion result:", result);
  const alerts = await checkAndCreateAlerts();
  console.log(`Alerts created: ${alerts.length}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
