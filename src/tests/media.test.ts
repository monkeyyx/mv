import { expect, test, describe } from "bun:test";
import app from "../api/index";

describe("Media Route Integration Tests", () => {
  test("GET /api/media/movie/3737 should return Avatar details", async () => {
    const res = await app.request("/api/media/movie/3737");
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.title).toContain("Avatar");
    expect(body.id).toBe("3737");
  });

  test("GET /api/media/show/13 should return Avatar Show details", async () => {
    const res = await app.request("/api/media/show/13");
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.title).toContain("Avatar");
    expect(Array.isArray(body.seasons)).toBe(true);
  });
});
