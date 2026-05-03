import { ShowboxService } from "../src/services/ShowboxService.js";
import { FebBoxService } from "../src/services/FebBoxService.js";

async function test() {
  const showbox = new ShowboxService();
  const febbox = new FebBoxService();

  console.log("0. Searching for Avatar...");
  const results = await showbox.search("Avatar", "movie");
  if (results.length === 0) return console.log("No results");
  const movie = results[0];
  console.log("Found:", movie.title, "(ID:", movie.id, ")");

  console.log(`1. Fetching FebBox ID for movie ${movie.id}...`);
  const febBoxId = await showbox.getFebBoxId(movie.id, movie.box_type);
  console.log("FebBox ID:", febBoxId);

  if (febBoxId) {
    console.log(`2. Fetching files for shareKey ${febBoxId}...`);
    const files = await febbox.getFileList(febBoxId);
    console.log("Files:", files);

    // Filter out directories and metadata files, find the video file
    const videoFiles = files.filter(f => !f.is_dir && (f.name.endsWith('.mp4') || f.name.endsWith('.mkv') || f.name.endsWith('.avi')));
    console.log("Video files:", videoFiles);

    if (videoFiles.length > 0) {
      const videoFile = videoFiles[0];
      console.log(`3. Fetching stream links for file ${videoFile.name} (fid: ${videoFile.id})...`);
      const links = await febbox.getLinks(videoFile.id, febBoxId);
      console.log("Stream Links:", links);
    } else {
        console.log("No video files found!");
    }
  }
}

test();
