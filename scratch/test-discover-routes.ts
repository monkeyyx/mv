import { TMDBService } from "../src/services/TMDBService.js";
import { ShowboxService } from "../src/services/ShowboxService.js";

async function test() {
  const tmdb = new TMDBService();
  const showbox = new ShowboxService();

  console.log("1. Fetching Popular Movies from TMDB...");
  const tmdbResults = await tmdb.getPopularMovies(1);
  console.log(`Found ${tmdbResults.length} popular movies. Checking first 3 for FebBox availability...`);

  for (const movie of tmdbResults.slice(0, 3)) {
    console.log(`\nChecking: ${movie.title}`);
    const searchResults = await showbox.search(movie.title);
    const found = searchResults.find(
      (result: any) => result.title.toLowerCase() === movie.title.toLowerCase(),
    );

    if (found) {
      const febBoxId = await showbox.getFebBoxId(found.id, found.box_type.toString());
      if (febBoxId) {
        console.log("✅ Available on FebBox! ID:", febBoxId);
      } else {
        console.log("❌ Found in Showbox, but no FebBox ID.");
      }
    } else {
      console.log("❌ Not found in Showbox.");
    }
  }
}

test();
