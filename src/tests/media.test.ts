import { describe, expect, test } from "bun:test";
import request from "supertest";
import { app } from "../index";

describe("Media Routes", () => {
  describe("GET /api/media/movie/:id", () => {
    test("should return movie details with a stream link", async () => {
      const response = await request(app)
        .get("/api/media/movie/24535")
        .expect(200)
        .expect("Content-Type", /json/);

      const body = response.body;

      expect(body).toHaveProperty("id");
      expect(body).toHaveProperty("title");
      expect(body).toHaveProperty("stream_link");
      expect(body.stream_link).toContain(".m3u8");
    }, 30000); // Increase timeout to 30 seconds
  });
});
