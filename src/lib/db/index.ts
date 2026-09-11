import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

declare global {
  var __mrlSql: ReturnType<typeof postgres> | undefined;
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. Copy .env.example to .env and fill in a Postgres connection string."
  );
}

// Reuse the connection across hot reloads in dev / serverless invocations.
const sql =
  global.__mrlSql ??
  postgres(connectionString, {
    max: process.env.NODE_ENV === "production" ? 5 : 1,
  });

if (process.env.NODE_ENV !== "production") {
  global.__mrlSql = sql;
}

export const db = drizzle(sql, { schema });
export type Db = typeof db;
