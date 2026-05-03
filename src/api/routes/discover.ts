import { Hono } from "hono";
import type { Bindings, Variables } from "../types";
import { TMDBService } from "../../core/services/TMDBService";
import { ShowboxService } from "../../core/services/ShowboxService";
import type { Movie } from "../../core/types";
import { optimizeImage } from "../../core/utils/images";

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
import { requestManager } from "../../core/utils/RequestManager";

async function filterAvailable(
  c: any,
  fetcher: (page: number) => Promise<Movie[]>,
  page: number,
  cacheKey: string,
): Promise<{ page: number; total: number; results: Movie[] }> {
  const cache = c.var.cache;
  const fullCacheKey = `discover:${cacheKey}:${page}`;

  // 1. Get from Cache (with SWR support)
  const { value: cached, isStale } = await cache.getWithMetadata(fullCacheKey);

  // If we have a cached value, we decide how to handle it
  if (cached) {
    c.header("X-Cache", isStale ? "STALE" : "HIT");

    // If it's stale, trigger a background refresh (Cloudflare Workers ctx.waitUntil)
    if (isStale) {
      const refreshTask = async () => {
        try {
          console.log(`[Discover] SWR Refreshing: ${fullCacheKey}`);
          await performFetchAndCache(c, fetcher, page, fullCacheKey);
        } catch (e) {
          console.error(`[Discover] Background Refresh Failed for ${fullCacheKey}:`, e);
        }
      };

      if (c.executionCtx && c.executionCtx.waitUntil) {
        c.executionCtx.waitUntil(refreshTask());
      } else {
        // Fallback for local development (run async but don't wait)
        refreshTask();
      }
    }

    return cached as any;
  }

  // 2. Cache Miss: Perform full fetch and store
  c.header("X-Cache", "MISS");
  return performFetchAndCache(c, fetcher, page, fullCacheKey);
}

/**
 * Shared logic for performing the actual fetch and cross-checking, 
 * wrapped in RequestManager to avoid duplicate fetches.
 */
async function performFetchAndCache(
  c: any,
  fetcher: (page: number) => Promise<Movie[]>,
  page: number,
  fullCacheKey: string,
): Promise<any> {
  const cache = c.var.cache;

  return requestManager.run(fullCacheKey, async () => {
    console.log(`[Discover] Fetching Fresh Data: ${fullCacheKey}`);
    const raw = await fetcher(page);

    const results = (
      await Promise.all(
        raw.map(async (movie) => {
          // Optimize the TMDB poster before searching/caching
          const optimizedPoster = optimizeImage(movie.poster, 400);

          try {
            // Check granular cache for this specific movie search (to avoid 700ms ShowBox hits)
            const movieSearchKey = `sb:search:${movie.title.toLowerCase().replace(/[^a-z0-9]/g, "")}:${movie.year}`;
            const cachedMatch = await cache.get(movieSearchKey);
            
            if (cachedMatch) {
              return {
                ...movie,
                poster: optimizedPoster,
                isAvailable: true,
                showbox_id: cachedMatch.id,
                box_type: cachedMatch.box_type,
                stream_url: `/api/media/stream/${cachedMatch.id}`,
                play_url: `/api/media/play/${cachedMatch.id}`,
              } as Movie;
            }

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
              const resultData = {
                ...movie,
                poster: optimizedPoster,
                isAvailable: true,
                showbox_id: found.id,
                box_type: found.box_type,
                stream_url: `/api/media/stream/${found.id}`,
                play_url: `/api/media/play/${found.id}`,
              } as Movie;

              // Cache individual match for 24h to speed up future discovery lists
              if (c.executionCtx?.waitUntil) {
                c.executionCtx.waitUntil(cache.set(movieSearchKey, { id: found.id, box_type: found.box_type }, 86400));
              } else {
                cache.set(movieSearchKey, { id: found.id, box_type: found.box_type }, 86400);
              }

              return resultData;
            }
          } catch (e) {
            console.error(`Check failed for ${movie.title}:`, e);
          }
          return null;
        }),
      )
    ).filter((m): m is Movie => m !== null);

    const response = { page, total: results.length, results };

    // Store in Cache: 1 hour fresh, 24 hours SWR window
    await cache.set(fullCacheKey, response, 3600, 86400);

    return response;
  });
}

// ---------------------------------------------------------------------------
// Movies
// ---------------------------------------------------------------------------

discover.get("/movies/popular", async (c) => {
  const page = parseInt(c.req.query("page") || "1");
  const data = await filterAvailable(c, tmdb.getPopularMovies.bind(tmdb), page, "movies:popular");
  c.header("Cache-Control", "public, s-maxage=3600, max-age=300, stale-while-revalidate=600");
  return c.json(data);
});

discover.get("/movies/top_rated", async (c) => {
  const page = parseInt(c.req.query("page") || "1");
  const data = await filterAvailable(c, tmdb.getTopRatedMovies.bind(tmdb), page, "movies:top_rated");
  c.header("Cache-Control", "public, s-maxage=3600, max-age=300, stale-while-revalidate=600");
  return c.json(data);
});

discover.get("/movies/now_playing", async (c) => {
  const page = parseInt(c.req.query("page") || "1");
  const data = await filterAvailable(c, tmdb.getNowPlayingMovies.bind(tmdb), page, "movies:now_playing");
  c.header("Cache-Control", "public, s-maxage=3600, max-age=300, stale-while-revalidate=600");
  return c.json(data);
});

discover.get("/movies/upcoming", async (c) => {
  const page = parseInt(c.req.query("page") || "1");
  const data = await filterAvailable(c, tmdb.getUpcomingMovies.bind(tmdb), page, "movies:upcoming");
  c.header("Cache-Control", "public, s-maxage=3600, max-age=300, stale-while-revalidate=600");
  return c.json(data);
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
