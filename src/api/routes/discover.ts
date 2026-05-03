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
  c: any,
  fetcher: (page: number) => Promise<Movie[]>,
  page: number,
  cacheKey: string,
): Promise<{ page: number; total: number; results: Movie[] }> {
  const cache = c.var.cache;
  const fullCacheKey = `discover:${cacheKey}:${page}`;

  // 1. Check Cache
  const cached = await cache.get(fullCacheKey);
  if (cached) {
    console.log(`[Discover] Cache Hit: ${fullCacheKey}`);
    return cached as any;
  }

  console.log(`[Discover] Cache Miss: ${fullCacheKey}. Fetching...`);
  const raw = await fetcher(page);

  // 2. Parallel ShowBox Availability Checks
  const results = (
    await Promise.all(
      raw.map(async (movie) => {
        try {
          const searchResults = await showbox.search(
            movie.title,
            "all",
            movie.year?.toString(),
          );
          const found = searchResults.find((result) => {
            const a = movie.title.toLowerCase().replace(/[^a-z0-9]/g, "");
            const b = result.title.toLowerCase().replace(/[^a-z0-9]/g, "");
            const match = b.includes(a) || a.includes(b);
            return (
              match &&
              (!movie.year ||
                Math.abs(
                  parseInt(result.year || "0") - parseInt(movie.year || "0"),
                ) <= 1)
            );
          });

          if (found) {
            return {
              ...movie,
              isAvailable: true,
              showbox_id: found.id,
              box_type: found.box_type,
              stream_url: `/api/media/stream/${found.id}`,
              play_url: `/api/media/play/${found.id}`,
            } as Movie;
          }
        } catch (e) {
          console.error(`Check failed for ${movie.title}:`, e);
        }
        return null;
      }),
    )
  ).filter((m): m is Movie => m !== null);

  const response = { page, total: results.length, results };

  // 3. Store in Cache (1 hour)
  await cache.set(fullCacheKey, response, 3600);

  return response;
}

// ---------------------------------------------------------------------------
// Movies
// ---------------------------------------------------------------------------

discover.get("/movies/popular", async (c) => {
  const page = parseInt(c.req.query("page") || "1");
  return c.json(await filterAvailable(c, tmdb.getPopularMovies.bind(tmdb), page, "movies:popular"));
});

discover.get("/movies/top_rated", async (c) => {
  const page = parseInt(c.req.query("page") || "1");
  return c.json(
    await filterAvailable(c, tmdb.getTopRatedMovies.bind(tmdb), page, "movies:top_rated")
  );
});

discover.get("/movies/now_playing", async (c) => {
  const page = parseInt(c.req.query("page") || "1");
  return c.json(
    await filterAvailable(c, tmdb.getNowPlayingMovies.bind(tmdb), page, "movies:now_playing")
  );
});

discover.get("/movies/upcoming", async (c) => {
  const page = parseInt(c.req.query("page") || "1");
  return c.json(
    await filterAvailable(c, tmdb.getUpcomingMovies.bind(tmdb), page, "movies:upcoming")
  );
});

// ---------------------------------------------------------------------------
// TV Shows
// ---------------------------------------------------------------------------

discover.get("/shows/popular", async (c) => {
  const page = parseInt(c.req.query("page") || "1");
  return c.json(await filterAvailable(c, tmdb.getPopularShows.bind(tmdb), page, "shows:popular"));
});

discover.get("/shows/top_rated", async (c) => {
  const page = parseInt(c.req.query("page") || "1");
  return c.json(
    await filterAvailable(c, tmdb.getTopRatedShows.bind(tmdb), page, "shows:top_rated")
  );
});

discover.get("/shows/airing_today", async (c) => {
  const page = parseInt(c.req.query("page") || "1");
  return c.json(
    await filterAvailable(c, tmdb.getAiringTodayShows.bind(tmdb), page, "shows:airing_today")
  );
});

// ---------------------------------------------------------------------------
// Genres  (convenience endpoints)
// ---------------------------------------------------------------------------

discover.get("/movies/animation", async (c) => {
  const page = parseInt(c.req.query("page") || "1");
  return c.json(
    await filterAvailable(c, tmdb.getAnimationMovies.bind(tmdb), page, "movies:animation")
  );
});

discover.get("/shows/anime", async (c) => {
  const page = parseInt(c.req.query("page") || "1");
  return c.json(await filterAvailable(c, tmdb.getAnime.bind(tmdb), page, "shows:anime"));
});

discover.get("/shows/korean", async (c) => {
  const page = parseInt(c.req.query("page") || "1");
  return c.json(await filterAvailable(c, tmdb.getKoreanDramas.bind(tmdb), page, "shows:korean"));
});

discover.get("/movies/action", async (c) => {
  const page = parseInt(c.req.query("page") || "1");
  return c.json(await filterAvailable(c, tmdb.getActionMovies.bind(tmdb), page, "movies:action"));
});

discover.get("/movies/comedy", async (c) => {
  const page = parseInt(c.req.query("page") || "1");
  return c.json(await filterAvailable(c, tmdb.getComedyMovies.bind(tmdb), page, "movies:comedy"));
});

discover.get("/movies/horror", async (c) => {
  const page = parseInt(c.req.query("page") || "1");
  return c.json(await filterAvailable(c, tmdb.getHorrorMovies.bind(tmdb), page, "movies:horror"));
});

discover.get("/movies/scifi", async (c) => {
  const page = parseInt(c.req.query("page") || "1");
  return c.json(await filterAvailable(c, tmdb.getSciFiMovies.bind(tmdb), page, "movies:scifi"));
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
      c,
      (p) =>
        tmdb.discoverMovies({
          page: p,
          genreId,
          language,
          sortBy,
          minRating,
        }),
      page,
      `movies:discover:${genreId}:${language}:${sortBy}:${minRating}`,
    ),
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
      c,
      (p) =>
        tmdb.discoverShows({
          page: p,
          genreId,
          language,
          sortBy,
          minRating,
        }),
      page,
      `shows:discover:${genreId}:${language}:${sortBy}:${minRating}`,
    ),
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
