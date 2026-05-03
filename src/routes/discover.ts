import { Router } from "express";
import { TMDBService } from "../services/TMDBService";
import { ShowboxService } from "../services/ShowboxService";
import type { Movie } from "../types";

const router = Router();
const tmdbService = new TMDBService();
const showboxService = new ShowboxService();

const fetchAndFilter = async (
  fetcher: (page: number) => Promise<Movie[]>,
  page: number,
): Promise<Movie[]> => {
  const tmdbResults = await fetcher(page);
  const availabilityChecks = tmdbResults.map(async (movie) => {
    const searchResults = await showboxService.search(movie.title);
    const found = searchResults.find(
      (result) => result.title.toLowerCase() === movie.title.toLowerCase(),
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
          box_type: found.box_type
        };
      }
    }
    return null;
  });

  const results = await Promise.all(availabilityChecks);
  return results.filter((movie): movie is Movie => movie !== null);
};

router.get("/movies/popular", async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    res.json(
      await fetchAndFilter(
        tmdbService.getPopularMovies.bind(tmdbService),
        page,
      ),
    );
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/movies/top_rated", async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    res.json(
      await fetchAndFilter(
        tmdbService.getTopRatedMovies.bind(tmdbService),
        page,
      ),
    );
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/shows/popular", async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    res.json(
      await fetchAndFilter(tmdbService.getPopularShows.bind(tmdbService), page),
    );
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/shows/top_rated", async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    res.json(
      await fetchAndFilter(
        tmdbService.getTopRatedShows.bind(tmdbService),
        page,
      ),
    );
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});
// --- Genres ---

router.get("/genres/movies", async (req, res) => {
  try {
    res.json(await tmdbService.getMovieGenres());
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/genres/shows", async (req, res) => {
  try {
    res.json(await tmdbService.getShowGenres());
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/movies/genre/:id", async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    res.json(
      await fetchAndFilter(
        (p) => tmdbService.getMoviesByGenre(req.params.id, p),
        page,
      ),
    );
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/shows/genre/:id", async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    res.json(
      await fetchAndFilter(
        (p) => tmdbService.getShowsByGenre(req.params.id, p),
        page,
      ),
    );
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
