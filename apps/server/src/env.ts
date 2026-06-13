import { fileURLToPath } from "node:url";

// Load the repo-root .env for local dev. In production (Railway) the env vars
// are already set and there is no .env file, so loadEnvFile throws — ignore it.
try {
  process.loadEnvFile(fileURLToPath(new URL("../../../.env", import.meta.url)));
} catch {
  // No .env present — rely on the real environment.
}
