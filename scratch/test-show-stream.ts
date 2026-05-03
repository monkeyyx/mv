import { ShowboxService } from "../src/services/ShowboxService.js";
import { FebBoxService } from "../src/services/FebBoxService.js";

async function test() {
  const showbox = new ShowboxService();
  const febbox = new FebBoxService();
  const showId = "125"; // Breaking Bad

  console.log(`1. Fetching FebBox ID for show ${showId}...`);
  const febBoxId = await showbox.getFebBoxId(showId, "2"); // "2" is for TV show
  console.log("FebBox ID:", febBoxId);

  if (febBoxId) {
    console.log(`2. Fetching root files for shareKey ${febBoxId}...`);
    const rootFiles = await febbox.getFileList(febBoxId);
    console.log("Root files:", rootFiles);

    // Get the first folder (usually Season 1)
    const seasonFolder = rootFiles.find(f => f.is_dir);
    if (seasonFolder) {
      console.log(`3. Fetching files for season folder ${seasonFolder.name} (id: ${seasonFolder.id})...`);
      const episodeFiles = await febbox.getFileList(febBoxId, seasonFolder.id);
      console.log(`Found ${episodeFiles.length} files in season folder.`);
      
      const firstEpisode = episodeFiles.find(f => !f.is_dir && (f.name.endsWith('.mp4') || f.name.endsWith('.mkv')));
      if (firstEpisode) {
        console.log(`4. Fetching stream links for first episode ${firstEpisode.name} (fid: ${firstEpisode.id})...`);
        const links = await febbox.getLinks(firstEpisode.id, febBoxId);
        console.log("Stream Links:", links);
      }
    }
  }
}

test();
