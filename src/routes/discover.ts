import { Router } from "express";
import { TMDBService } from "../services/TMDBService";
import { ShowboxService } from "../services/ShowboxService";
import type { Movie } from "../types";

const router = Router();
const tmdbService = new TMDBService();
const showboxService = new ShowboxService();

// FAST: Fetches 2 TMDB pages concurrently to guarantee ~30 results per page
const PER_PAGE = 30;

const fetchFast = async (
  fetcher: (page: number) => Promise<Movie[]>,
  page: number,
): Promise<{ page: number; per_page: number; total_results: number; has_next_page: boolean; results: Movie[] }> => {
  // Each TMDB page has 20 items. Fetch 2 pages concurrently to get enough raw data.
  const tmdbPage1 = (page - 1) * 2 + 1;
  const tmdbPage2 = tmdbPage1 + 1;

  const [raw1, raw2] = await Promise.all([fetcher(tmdbPage1), fetcher(tmdbPage2)]);
  const allRaw = [...raw1, ...raw2];

  const checks: Promise<Movie | null>[] = allRaw.map(async (movie) => {
    const searchResults = await showboxService.search(movie.title, "all", movie.year?.toString());
    const found = searchResults.find(
      (result) => result.title.toLowerCase() === movie.title.toLowerCase() && (!movie.year || result.year === movie.year),
    );
    if (found) {
      return {
        ...movie,
        isAvailable: true,
        showbox_id: found.id,
        box_type: found.box_type,
      } as Movie;
    }
    return null;
  });

  const matched = (await Promise.all(checks)).filter((movie): movie is Movie => movie !== null);
  const results = matched.slice(0, PER_PAGE);

  return {
    page,
    per_page: PER_PAGE,
    total_results: results.length,
    has_next_page: raw2.length > 0,
    results,
  };
};

// DEEP: Also verifies FebBox stream exists (~30s)
const fetchAndFilter = async (
  fetcher: (page: number) => Promise<Movie[]>,
  page: number,
): Promise<{ page: number; per_page: number; total_results: number; has_next_page: boolean; results: Movie[] }> => {
  const tmdbPage1 = (page - 1) * 2 + 1;
  const tmdbPage2 = tmdbPage1 + 1;
  const [raw1, raw2] = await Promise.all([fetcher(tmdbPage1), fetcher(tmdbPage2)]);
  const tmdbResults = [...raw1, ...raw2];

  const availabilityChecks: Promise<Movie | null>[] = tmdbResults.map(async (movie) => {
    const searchResults = await showboxService.search(movie.title, "all", movie.year?.toString());
    const found = searchResults.find(
      (result) => result.title.toLowerCase() === movie.title.toLowerCase() && (!movie.year || result.year === movie.year),
    );

    if (found) {
      const febBoxId = await showboxService.getFebBoxId(
        found.id,
        found.box_type.toString(),
      );
      if (febBoxId) {
        return {
          ...movie,
          isAvailable: true,
          showbox_id: found.id,
          box_type: found.box_type,
        } as Movie;
      }
    }
    return null;
  });

  const results = (await Promise.all(availabilityChecks))
    .filter((m): m is Movie => m !== null)
    .slice(0, PER_PAGE);

  return { page, per_page: PER_PAGE, total_results: results.length, has_next_page: raw2.length > 0, results };
};

router.get("/movies/popular", async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const deep = req.query.check === "true";
    const fn = deep ? fetchAndFilter : fetchFast;
    res.json(await fn(tmdbService.getPopularMovies.bind(tmdbService), page));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get("/movies/top_rated", async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const deep = req.query.check === "true";
    const fn = deep ? fetchAndFilter : fetchFast;
    res.json(await fn(tmdbService.getTopRatedMovies.bind(tmdbService), page));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get("/shows/popular", async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const deep = req.query.check === "true";
    const fn = deep ? fetchAndFilter : fetchFast;
    res.json(await fn(tmdbService.getPopularShows.bind(tmdbService), page));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get("/shows/top_rated", async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const deep = req.query.check === "true";
    const fn = deep ? fetchAndFilter : fetchFast;
    res.json(await fn(tmdbService.getTopRatedShows.bind(tmdbService), page));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// --- Genres ---

router.get("/genres/movies", async (req, res) => {
  try {
    res.json(await tmdbService.getMovieGenres());
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get("/genres/shows", async (req, res) => {
  try {
    res.json(await tmdbService.getShowGenres());
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get("/movies/genre/:id", async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const deep = req.query.check === "true";
    const fn = deep ? fetchAndFilter : fetchFast;
    res.json(await fn((p) => tmdbService.getMoviesByGenre(req.params.id, p), page));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get("/shows/genre/:id", async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const deep = req.query.check === "true";
    const fn = deep ? fetchAndFilter : fetchFast;
    res.json(await fn((p) => tmdbService.getShowsByGenre(req.params.id, p), page));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
