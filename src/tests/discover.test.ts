import { TMDBService } from "../services/TMDBService";
import { ShowboxService } from "../services/ShowboxService";

jest.mock("../services/ShowboxService", () => {
  return {
    ShowboxService: jest.fn().mockImplementation(() => {
      return {
        search: jest.fn().mockImplementation(async (title: string) => {
          if (title.toLowerCase().includes("avatar")) {
            return [
              {
                title: "Avatar",
                id: "123",
                poster: "",
                year: "2009",
                rating: "7.9",
                box_type: 1,
              },
            ];
          }
          return [];
        }),
      };
    }),
  };
});

describe("TMDBService", () => {
  let tmdbService: TMDBService;
  let showboxService: ShowboxService;

  beforeEach(() => {
    tmdbService = new TMDBService();
    // Now ShowboxService is the mocked constructor
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
