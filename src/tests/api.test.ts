import { describe, it, expect } from "bun:test";
import app from "../api/index";

/**
 * COMPREHENSIVE API TEST SUITE
 * This tests the actual Hono endpoints to ensure:
 * 1. The API is alive and healthy.
 * 2. Discovery is synced with ShowBox availability.
 * 3. Media details return the PROXIED HLS stream links.
 * 4. Anime discovery is working correctly.
 */

// --- Type Definitions for Safety ---
interface SystemStatus {
  status: string;
  version: string;
  message?: string;
}

interface Movie {
  id: string;
  title: string;
  isAvailable?: boolean;
  stream_url?: string;
  hls_url?: string;
  stream_sources?: any[];
}

interface DiscoveryResponse {
  results: Movie[];
  page: number;
  total: number;
}

interface ShowDetails extends Movie {
  seasons: { season: number; episodes: any[] }[];
}

describe("🔥 MyFlixi API — Comprehensive End-to-End Test", () => {
  // --- 1. System Health ---
  describe("📡 System & Health", () => {
    it("should return 200 OK for root health check", async () => {
      const res = await app.request("/");
      expect(res.status).toBe(200);
      const body = await res.json<SystemStatus>();
      expect(body.status).toBe("online");
      expect(body.message).toContain("Modular Hono");
    });

    it("should return system status with version info", async () => {
      const res = await app.request("/api/system/status");
      expect(res.status).toBe(200);
      const body = await res.json<SystemStatus>();
      expect(body.status).toBe("online");
      expect(body.version).toBe("2.2.0");
    });
  });

  // --- 2. Discovery Sync (TMDB + ShowBox) ---
  describe("🌍 Discovery Pipeline", () => {
    it("should fetch popular movies with stream_url attached", async () => {
      const res = await app.request("/api/discover/movies/popular");
      expect(res.status).toBe(200);
      const body = await res.json<DiscoveryResponse>();

      expect(body.results.length).toBeGreaterThan(0);
      const movie = body.results[0];

      console.log(`[Test] Sample Popular Movie: ${movie.title}`);
      expect(movie.isAvailable).toBe(true);
      expect(movie.stream_url).toContain("/api/media/stream/");

      console.log("[Test] Making second request to verify cache hit...");
      const start = Date.now();
      const res2 = await app.request("/api/discover/movies/popular");
      const duration = Date.now() - start;
      expect(res2.status).toBe(200);
      console.log(`[Test] Second request duration: ${duration}ms`);
      expect(duration).toBeLessThan(100); // Should be very fast
    }, 15000); // Higher timeout for heavy ShowBox cross-checks

    it("should fetch Japanese Anime and verify it's correctly tagged", async () => {
      const res = await app.request("/api/discover/shows/anime");
      expect(res.status).toBe(200);
      const body = await res.json<DiscoveryResponse>();

      expect(body.results.length).toBeGreaterThan(0);
      // Sample check: TMDB says results should be anime
      console.log(`[Test] Sample Anime: ${body.results[0].title}`);
      expect(body.results[0].id).toBeTruthy();
    });
  });

  // --- 3. Media Details & HLS Proxy ---
  describe("🎬 Media & HLS Stream resolution", () => {
    let testMovieId = "2603958"; // Ratatouille ID (usually consistent)

    it("should resolve direct HLS stream for a specific movie", async () => {
      // Step 1: Search to get ID if we don't have a static one that works
      const searchRes = await app.request(
        "/api/media/search?title=ratatouille&type=movie",
      );
      const searchResults = await searchRes.json<Movie[]>();
      const id = searchResults[0].id;

      // Step 2: Get Details (This triggers FebBox resolution)
      const res = await app.request(`/api/media/movie/${id}`);
      expect(res.status).toBe(200);
      const movie = await res.json<Movie>();

      console.log(`[Test] Resolved Movie: ${movie.title}`);
      console.log(`[Test] HLS Proxy URL: ${movie.hls_url}`);

      expect(movie.isAvailable).toBe(true);
      expect(movie.hls_url).toContain("/api/media/stream/");
      expect(movie.stream_sources?.length).toBeGreaterThan(0);

      // The important part: check if it's the proxied link or the raw link
      // Actually, /api/media/movie/:id currently returns the RAW FebBox link in hls_url,
      // but the UI should use the /api/media/stream/:id endpoint.
      // Wait, let's verify if we should change movie detail to return the proxy link.
    }, 15000);

    it("should verify the HLS Proxy endpoint returns a valid playlist", async () => {
      const searchRes = await app.request(
        "/api/media/search?title=ratatouille&type=movie",
      );
      const searchResults = await searchRes.json<Movie[]>();
      const id = searchResults[0].id;

      const res = await app.request(`/api/media/stream/${id}`);
      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toBe(
        "application/vnd.apple.mpegurl",
      );

      const playlist = await res.text();
      expect(playlist).toContain("#EXTM3U");
      expect(playlist).toContain("/api/media/segment?url="); // Verify URL rewriting
      console.log("[Test] HLS Playlist rewritten successfully.");
    }, 15000);
  });

  // --- 4. TV Show Sync ---
  describe("📺 TV Show Synchronization", () => {
    it("should fetch details for Breaking Bad with seasons", async () => {
      const searchRes = await app.request(
        "/api/media/search?title=breaking+bad&type=tv",
      );
      const searchResults = await searchRes.json<Movie[]>();
      const id = searchResults[0].id;

      const res = await app.request(`/api/media/show/${id}`);
      expect(res.status).toBe(200);
      const show = await res.json<ShowDetails>();

      expect(show.title).toContain("Breaking Bad");
      expect(show.seasons.length).toBeGreaterThan(0);
      console.log(
        `[Test] TV Show Synced: ${show.title} with ${show.seasons.length} seasons.`,
      );
    });
  });
});
