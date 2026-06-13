import { fileURLToPath } from "node:url";
import { defineConfig } from "drizzle-kit";

// Load the repo-root .env so DATABASE_URL is available to drizzle-kit.
try {
  process.loadEnvFile(fileURLToPath(new URL("../../.env", import.meta.url)));
} catch {
  // rely on the ambient environment
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
});
