import { ShowboxService } from "../src/services/ShowboxService.js";

async function test() {
  const api = new ShowboxService();
  console.log("Fetching Movie Details (id: 24535)...");
  const movieDetails = await api.getMovieDetails("24535");
  console.log(JSON.stringify(movieDetails, null, 2));

  console.log("\nFetching Show Details (id: 125)...");
  const showDetails = await api.getShowDetails("125");
  console.log(JSON.stringify(showDetails, null, 2));
}

test();
