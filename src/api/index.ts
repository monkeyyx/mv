import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Bindings, Variables } from "./types";
import { validateEnv } from "../core/utils/config";

// Import Modular Routes
import system from "./routes/system";
import media from "./routes/media";
import febbox from "./routes/febbox";
import discover from "./routes/discover";

import { CacheService } from "../core/services/CacheService";

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// Persistent cache instance for local development
let localCacheInstance: CacheService | null = null;

// --- Global Middleware ---
app.use("*", cors());

// Populate c.env from process.env for local development (Bun/Node)
app.use("*", async (c, next) => {
  if (typeof process !== "undefined") {
    if (!c.env || Object.keys(c.env).length === 0) {
      try {
        (c as any).env = { ...c.env, ...process.env };
      } catch (e) {}
    }
  }

  // Initialize Cache Service
  if (!localCacheInstance) {
    localCacheInstance = new CacheService(c.env.MYFLIXI_CACHE);
  }
  c.set("cache", localCacheInstance);

  // Validate environment variables using Zod
  try {
    validateEnv(c.env);
  } catch (e) {
    return c.json(
      {
        error: "Environment Configuration Error",
        message: (e as Error).message,
      },
      500,
    );
  }

  await next();
});

import { Scalar } from "@scalar/hono-api-reference";
import { openApiSpec } from "./openapi";

// --- Mount Routes ---
app.route("/api/system", system);
app.route("/api/media", media);
app.route("/api/febbox", febbox);
app.route("/api/discover", discover);

// --- Documentation ---
app.get(
  "/docs",
  Scalar({
    spec: {
      url: "/openapi.json",
    },
    theme: "deepSpace", // Theme (default, moon, purple, solarized, bluePlanet, saturn, kepler, mars, deepSpace, laserwave, alternate, none)
    layout: "modern",
    pageTitle: "MyFlixi API Reference",
  } as any),
);

// --- OpenAPI Spec ---
app.get("/openapi.json", (c) => {
  return c.json(openApiSpec);
});

// --- Health Check ---
app.get("/", (c) =>
  c.json({
    message: "MyFlixi Edge API v2.3.0 (Durable Sessions)",
    docs: "/docs",
    status: "online",
  }),
);

export { FebBoxSession } from "../core/services/FebBoxSession";
export default app;
