import { expect, it, describe, beforeEach } from "bun:test";
import { TMDBService } from "../core/services/TMDBService";
import { ShowboxService } from "../core/services/ShowboxService";
import dotenv from "dotenv";

dotenv.config();

describe("Discovery Pipeline Unit Tests", () => {
  let tmdb: TMDBService;
  let showbox: ShowboxService;

  beforeEach(() => {
    tmdb = new TMDBService();
    tmdb.apiKey = process.env.TMDB_API_KEY || "";
    showbox = new ShowboxService();
  });

  it("should fetch popular movies from TMDB", async () => {
    if (!tmdb.apiKey) return;
    const movies = await tmdb.getPopularMovies();
    expect(Array.isArray(movies)).toBe(true);
    expect(movies.length).toBeGreaterThan(0);
  });

  it("should find matches in Showbox for TMDB movies", async () => {
    if (!tmdb.apiKey) return;
    const movies = await tmdb.getPopularMovies();
    const movie = movies[0];
    const results = await showbox.search(movie.title, "all", movie.year);
    expect(Array.isArray(results)).toBe(true);
  });
});
