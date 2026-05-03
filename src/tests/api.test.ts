import { expect, test, describe } from "bun:test";

const BASE_URL = "http://localhost:3000";

describe("MyFlixi v2.1 Modular API Suite", () => {
  
  // --- SYSTEM MODULE ---
  describe("⚡ System Endpoints", () => {
    test("GET /api/system/status - Health Check", async () => {
      const res = await fetch(`${BASE_URL}/api/system/status`);
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data.status).toBe("online");
      expect(data.version).toContain("Modular");
    });

    test("GET /api/system/set-cookie - Auth Protection", async () => {
      const res = await fetch(`${BASE_URL}/api/system/set-cookie?secret=wrong&cookie=test`);
      const data = await res.json();
      expect(res.status).toBe(403);
      expect(data.error).toBe("Unauthorized");
    });
  });

  // --- MEDIA MODULE ---
  describe("🎬 Media Discovery", () => {
    test("GET /api/media/autocomplete - Suggestions", async () => {
      const res = await fetch(`${BASE_URL}/api/media/autocomplete?keyword=avatar`);
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
    });

    test("GET /api/media/search - Global Search", async () => {
      const res = await fetch(`${BASE_URL}/api/media/search?title=avatar`);
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data.length).toBeGreaterThan(0);
    });

    test("GET /api/media/movie/:id - Metadata", async () => {
      const res = await fetch(`${BASE_URL}/api/media/movie/24535`); // Avatar ID
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data).toHaveProperty("title");
    });
  });

  // --- FEBBOX MODULE ---
  describe("📦 FebBox Cloud", () => {
    test("GET /api/febbox/folder/root - Navigation", async () => {
      const res = await fetch(`${BASE_URL}/api/febbox/folder/root`);
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(Array.isArray(data.files)).toBe(true);
    });

    test("GET /api/febbox/console/search - Private Search", async () => {
      const res = await fetch(`${BASE_URL}/api/febbox/console/search?q=test`);
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
    });

    test("GET /api/febbox/watch/:fid - Stream Resolver", async () => {
      const res = await fetch(`${BASE_URL}/api/febbox/watch/12345`); // Mock ID
      expect(res.status).toBe(200);
    });
  });

});
