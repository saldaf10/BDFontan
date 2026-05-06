import { config } from "dotenv";
import { defineConfig } from "prisma/config";

config({ path: ".env.local", override: true });

const migrationUrl =
  process.env.DATABASE_URL_UNPOOLED ??
  process.env.POSTGRES_URL_NON_POOLING ??
  process.env.DIRECT_URL ??
  process.env.DATABASE_URL;

if (!migrationUrl) {
  throw new Error("Missing database URL for Prisma migrations");
}

export default defineConfig({
  datasource: {
    url: migrationUrl
  }
});
