import { Hono } from "hono";
import type { Bindings, Variables } from "../types";
import { TMDBService } from "../../core/services/TMDBService";
import { ShowboxService } from "../../core/services/ShowboxService";
import type { Movie } from "../../core/types";

const discover = new Hono<{ Bindings: Bindings; Variables: Variables }>();
const tmdb = new TMDBService();
const showbox = new ShowboxService();

discover.use("*", async (c, next) => {
  tmdb.apiKey = c.env.TMDB_API_KEY;
  await next();
});

// ---------------------------------------------------------------------------
// Core: fetch TMDB list → cross-check ShowBox availability → return only matches
// ---------------------------------------------------------------------------
async function filterAvailable(
  fetcher: (page: number) => Promise<Movie[]>,
  page: number
): Promise<{ page: number; total: number; results: Movie[] }> {
  const raw = await fetcher(page);

  const checks = raw.map(async (movie) => {
    const searchResults = await showbox.search(
      movie.title,
      "all",
      movie.year?.toString()
    );
    const found = searchResults.find((result) => {
      const a = movie.title.toLowerCase().replace(/[^a-z0-9]/g, "");
      const b = result.title.toLowerCase().replace(/[^a-z0-9]/g, "");
      const match = b.includes(a) || a.includes(b);
      return (
        match &&
        (!movie.year ||
          Math.abs(
            parseInt(result.year || "0") - parseInt(movie.year || "0")
          ) <= 1)
      );
    });

    if (found) {
      return {
        ...movie,
        isAvailable: true,
        showbox_id: found.id,
        box_type: found.box_type,
        // Convenience: direct stream URL
        stream_url: `/api/media/stream/${found.id}`,
        play_url: `/api/media/play/${found.id}`,
      } as Movie & { stream_url: string; play_url: string };
    }
    return null;
  });

  const results = (await Promise.all(checks)).filter(
    (m): m is Movie & { stream_url: string; play_url: string } => m !== null
  );

  return { page, total: results.length, results };
}

// ---------------------------------------------------------------------------
// Movies
// ---------------------------------------------------------------------------

discover.get("/movies/popular", async (c) => {
  const page = parseInt(c.req.query("page") || "1");
  return c.json(await filterAvailable(tmdb.getPopularMovies.bind(tmdb), page));
});

discover.get("/movies/top_rated", async (c) => {
  const page = parseInt(c.req.query("page") || "1");
  return c.json(
    await filterAvailable(tmdb.getTopRatedMovies.bind(tmdb), page)
  );
});

discover.get("/movies/now_playing", async (c) => {
  const page = parseInt(c.req.query("page") || "1");
  return c.json(
    await filterAvailable(tmdb.getNowPlayingMovies.bind(tmdb), page)
  );
});

discover.get("/movies/upcoming", async (c) => {
  const page = parseInt(c.req.query("page") || "1");
  return c.json(
    await filterAvailable(tmdb.getUpcomingMovies.bind(tmdb), page)
  );
});

// ---------------------------------------------------------------------------
// TV Shows
// ---------------------------------------------------------------------------

discover.get("/shows/popular", async (c) => {
  const page = parseInt(c.req.query("page") || "1");
  return c.json(await filterAvailable(tmdb.getPopularShows.bind(tmdb), page));
});

discover.get("/shows/top_rated", async (c) => {
  const page = parseInt(c.req.query("page") || "1");
  return c.json(
    await filterAvailable(tmdb.getTopRatedShows.bind(tmdb), page)
  );
});

discover.get("/shows/airing_today", async (c) => {
  const page = parseInt(c.req.query("page") || "1");
  return c.json(
    await filterAvailable(tmdb.getAiringTodayShows.bind(tmdb), page)
  );
});

// ---------------------------------------------------------------------------
// Genres  (convenience endpoints)
// ---------------------------------------------------------------------------

discover.get("/movies/animation", async (c) => {
  const page = parseInt(c.req.query("page") || "1");
  return c.json(
    await filterAvailable(tmdb.getAnimationMovies.bind(tmdb), page)
  );
});

discover.get("/shows/anime", async (c) => {
  const page = parseInt(c.req.query("page") || "1");
  return c.json(await filterAvailable(tmdb.getAnime.bind(tmdb), page));
});

discover.get("/shows/korean", async (c) => {
  const page = parseInt(c.req.query("page") || "1");
  return c.json(await filterAvailable(tmdb.getKoreanDramas.bind(tmdb), page));
});

discover.get("/movies/action", async (c) => {
  const page = parseInt(c.req.query("page") || "1");
  return c.json(await filterAvailable(tmdb.getActionMovies.bind(tmdb), page));
});

discover.get("/movies/comedy", async (c) => {
  const page = parseInt(c.req.query("page") || "1");
  return c.json(await filterAvailable(tmdb.getComedyMovies.bind(tmdb), page));
});

discover.get("/movies/horror", async (c) => {
  const page = parseInt(c.req.query("page") || "1");
  return c.json(await filterAvailable(tmdb.getHorrorMovies.bind(tmdb), page));
});

discover.get("/movies/scifi", async (c) => {
  const page = parseInt(c.req.query("page") || "1");
  return c.json(await filterAvailable(tmdb.getSciFiMovies.bind(tmdb), page));
});

// ---------------------------------------------------------------------------
// Generic discover with full query params
// GET /api/discover/movies?genre=28&language=ja&sort=vote_average.desc&page=1
// GET /api/discover/shows?genre=16&language=ko
// ---------------------------------------------------------------------------

discover.get("/movies", async (c) => {
  const page = parseInt(c.req.query("page") || "1");
  const genreId = c.req.query("genre");
  const language = c.req.query("language");
  const sortBy = c.req.query("sort");
  const minRating = c.req.query("min_rating")
    ? parseFloat(c.req.query("min_rating")!)
    : undefined;

  return c.json(
    await filterAvailable(
      (p) => tmdb.discoverMovies({ page: p, genreId, language, sortBy, minRating }),
      page
    )
  );
});

discover.get("/shows", async (c) => {
  const page = parseInt(c.req.query("page") || "1");
  const genreId = c.req.query("genre");
  const language = c.req.query("language");
  const sortBy = c.req.query("sort");
  const minRating = c.req.query("min_rating")
    ? parseFloat(c.req.query("min_rating")!)
    : undefined;

  return c.json(
    await filterAvailable(
      (p) => tmdb.discoverShows({ page: p, genreId, language, sortBy, minRating }),
      page
    )
  );
});

// ---------------------------------------------------------------------------
// Genre list endpoints (for building filter UIs)
// ---------------------------------------------------------------------------

discover.get("/genres/movies", async (c) => {
  const genres = await tmdb.getMovieGenres();
  return c.json({ genres });
});

discover.get("/genres/shows", async (c) => {
  const genres = await tmdb.getShowGenres();
  return c.json({ genres });
});

export default discover;
