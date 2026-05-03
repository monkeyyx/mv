import { ShowboxService } from "../services/ShowboxService.js";
import { FebBoxService } from "../services/FebBoxService.js";
import dotenv from "dotenv";

dotenv.config();

(async () => {
  const api = new ShowboxService();
  const febboxApi = new FebBoxService();

  // Search for a movie
  const movieTitle = "ratatouille";
  const results = await api.search(movieTitle, "movie");
  const movie = results[0];
  console.log("🎬 Movie:", movie);

  // Fetch FebBox ID and file links for the movie
  let febBoxId = await api.getFebBoxId(movie.id, movie.box_type);
  if (febBoxId) {
    console.log("🔗 FebBox ID:", febBoxId);
    const files = await febboxApi.getFileList(febBoxId);
    console.log("📂 File List:", files);
    const file = files[1];
    const links = await febboxApi.getPublicLinks(febBoxId, file.id);
    console.log("🌐 Links:", links);
  }

  // Search for a TV show
  const showTitle = "breaking bad";
  const showResults = await api.search(showTitle, "tv");
  const show = showResults[0];
  console.log("📺 Show:", show);

  // Fetch show details and FebBox ID
  const showId = show.id;
  const showDetails = await api.getShowDetails(showId);
  console.log("📜 Show Details:", showDetails);

  febBoxId = await api.getFebBoxId(show.id, show.box_type);
  if (febBoxId) {
    const files = await febboxApi.getFileList(febBoxId);
    console.log("📂 File List:", files);
    const file = files[4];
    if (file.is_dir) {
      const seasonFiles = await febboxApi.getFileList(febBoxId, file.id);
      console.log("📂 Season Files:", seasonFiles);
      const seasonFile = seasonFiles[0];
      const links = await febboxApi.getPublicLinks(febBoxId, seasonFile.id);
      console.log("🌐 Season Links:", links);
    } else {
      const links = await febboxApi.getPublicLinks(febBoxId, file.id);
      console.log("🌐 Links:", links);
    }
  }
})();
