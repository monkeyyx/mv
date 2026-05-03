import { z } from "zod";

export const envSchema = z.object({
  FEBBOX_UI_COOKIE: z.string().optional(),
  FEBBOX_EMAIL: z.string().optional(),
  FEBBOX_PASSWORD: z.string().optional(),
  ADMIN_SECRET: z.string().default("admin"),
  API_PORT: z.string().default("3000"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  TMDB_API_KEY: z.string().min(1, "TMDB_API_KEY is required"),
  UPSTASH_REDIS_REST_URL: z.string().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

export const validateEnv = (env: Record<string, unknown>): Env => {
  const result = envSchema.safeParse(env);
  if (!result.success) {
    console.error("❌ Invalid environment variables:", result.error.format());
    // In Worker we don't want to exit(1), we might want to throw or just log
    throw new Error("Invalid environment configuration");
  }
  return result.data;
};
