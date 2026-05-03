import request from "supertest";
import { app } from "../index";

describe("Media Routes", () => {
  describe("GET /api/media/movie/:id", () => {
    test("should return movie details with stream links", async () => {
      const response = await request(app)
        .get("/api/media/movie/24535")
        .expect(200)
        .expect("Content-Type", /json/);

      const body = response.body;

      expect(body).toHaveProperty("id");
      expect(body).toHaveProperty("title");
      expect(body).toHaveProperty("stream_sources");
      expect(Array.isArray(body.stream_sources)).toBe(true);
    }, 30000);
  });
});
