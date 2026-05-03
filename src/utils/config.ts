import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

const envSchema = z.object({
  FEBBOX_UI_COOKIE: z.string().optional(),
  ADMIN_SECRET: z.string().default("admin"),
  API_PORT: z.string().default("3000"),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  TMDB_API_KEY: z.string().min(1, "TMDB_API_KEY is required"),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error("❌ Invalid environment variables:", _env.error.format());
  process.exit(1);
}

export const config = _env.data;
