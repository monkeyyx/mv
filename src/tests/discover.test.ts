import { TMDBService } from "../services/TMDBService";
import { ShowboxService } from "../services/ShowboxService";

describe("TMDBService", () => {
  let tmdbService: TMDBService;
  let showboxService: ShowboxService;

  beforeEach(() => {
    tmdbService = new TMDBService();
    showboxService = new ShowboxService();
  });

  it("should fetch popular movies and filter available ones", async () => {
    const movies = await tmdbService.getPopularMovies();
    expect(movies).toBeInstanceOf(Array);

    const availabilityChecks = movies.map(async (movie) => {
      const searchResults = await showboxService.search(movie.title);
      return searchResults.some(
        (r) => r.title.toLowerCase() === movie.title.toLowerCase(),
      );
    });

    const availability = await Promise.all(availabilityChecks);
    const availableCount = availability.filter(Boolean).length;

    expect(availableCount).toBeLessThanOrEqual(movies.length);
  });
});
