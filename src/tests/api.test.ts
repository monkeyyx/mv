import { expect, test, describe } from "bun:test";
import request from "supertest";
import { app } from "../index";

describe("MyFlixi v2.1 Modular API Suite", () => {
  // --- SYSTEM MODULE ---
  describe("⚡ System Endpoints", () => {
    test("GET /api/system/status - Health Check", async () => {
      const res = await request(app).get("/api/system/status");
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("online");
    });

    test("GET /api/system/set-cookie - Auth Protection", async () => {
      const res = await request(app).get(
        "/api/system/set-cookie?secret=wrong&cookie=test",
      );
      expect(res.status).toBe(403);
      expect(res.body.error).toBe("Unauthorized");
    });
  });

  // --- MEDIA MODULE ---
  describe("🎬 Media Discovery", () => {
    test("GET /api/media/autocomplete - Suggestions", async () => {
      const res = await request(app).get(
        "/api/media/autocomplete?keyword=avatar",
      );
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    test("GET /api/media/search - Global Search", async () => {
      const res = await request(app).get("/api/media/search?title=avatar");
      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThan(0);
    });

    test("GET /api/media/movie/:id - Metadata", async () => {
      const res = await request(app).get("/api/media/movie/24535");
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("title");
    });
  });

  // --- FEBBOX MODULE ---
  describe("📦 FebBox Cloud", () => {
    test("GET /api/febbox/folder/root - Navigation", async () => {
      const res = await request(app).get("/api/febbox/folder/root");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.files)).toBe(true);
    });

    test("GET /api/febbox/console/search - Private Search", async () => {
      const res = await request(app).get("/api/febbox/console/search?q=test");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    test("GET /api/febbox/watch/:fid - Stream Resolver", async () => {
      const res = await request(app).get("/api/febbox/watch/12345");
      expect(res.status).toBe(200);
    });
  });
});
