import { Router } from "express";
import { ShowboxService } from "../services/ShowboxService";
import { FebBoxService } from "../services/FebBoxService";

const router = Router();
const showbox = new ShowboxService();
const febbox = new FebBoxService();

router.get("/autocomplete", async (req, res) => {
  try {
    const keyword = (req.query.keyword as string) || "Avatar";
    res.json(await showbox.autocomplete(keyword));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/search", async (req, res) => {
  try {
    const q = (req.query.title || req.query.keyword || "Avatar") as string;
    res.json(await showbox.search(q, req.query.type as string));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Movie Details (with default)
router.get("/movie/:id", async (req, res) => {
  try {
    const id = req.params.id === "default" ? "24535" : req.params.id;
    const details = await showbox.getMovieDetails(id);

    if (details) {
      details.stream_sources = []; // Default to empty array
      details.isAvailable = false;
      
      try {
        const febBoxId = await showbox.getFebBoxId(id, "1");
        if (febBoxId) {
          details.isAvailable = true;
          const files = await febbox.getFileList(febBoxId);
          const videoFiles = files.filter(
            (f) =>
              !f.is_dir &&
              (f.name.endsWith(".mp4") ||
                f.name.endsWith(".mkv") ||
                f.name.endsWith(".avi")),
          );

          // HLS HUNTING: Iterate through files until we find one with HLS streams
          let foundHls = false;
          for (const file of videoFiles) {
            if (foundHls) break;

            const rawLinks = await febbox.getLinks(file.id, febBoxId);
            const hlsLinks = rawLinks.filter((l) => l.url.includes(".m3u8"));
            const orgLinks = rawLinks.filter((l) => !l.url.includes(".m3u8"));

            if (hlsLinks.length > 0) {
              foundHls = true;
              const baseUrl = `${req.protocol}://${req.get("host")}`;
              
              details.stream_sources = [...hlsLinks, ...orgLinks].map((l) => ({
                quality: l.quality,
                label: l.label,
                size: l.size,
                is_hls: l.url.includes(".m3u8"),
                direct_url: l.url,
                stream_url: `${baseUrl}/api/febbox/stream/${file.id}?quality=${l.quality}`,
              }));

              const best = hlsLinks.find((l) => l.quality === "1080p") || hlsLinks[0];
              details.hls_url = best.url;
              details.real_stream_link = `${baseUrl}/api/febbox/stream/${file.id}?quality=${best.quality}`;
            }
          }

          // Fallback: If no HLS found after hunting, use the first file's direct links
          if (!foundHls && videoFiles.length > 0) {
            const firstFile = videoFiles[0];
            const rawLinks = await febbox.getLinks(firstFile.id, febBoxId);
            const baseUrl = `${req.protocol}://${req.get("host")}`;
            
            details.stream_sources = rawLinks.map((l) => ({
              quality: l.quality,
              label: l.label,
              size: l.size,
              is_hls: false,
              direct_url: l.url,
              stream_url: `${baseUrl}/api/febbox/stream/${firstFile.id}?quality=${l.quality}`,
            }));
          }
        }
      } catch (err) {
        console.error("Failed to fetch movie stream links:", err);
      }
    }

    res.json(details);
  } catch (e: any) {
    console.error("Movie Details Route Error:", e);
    res.status(500).json({ error: e.message });
  }
});

router.get("/movie", async (req, res) => {
  try {
    res.json(await showbox.getMovieDetails("24535"));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Show Details (with default)
router.get("/show/:id", async (req, res) => {
  try {
    const id = req.params.id === "default" ? "125" : req.params.id;
    const details = await showbox.getShowDetails(id);

    if (details) {
      details.isAvailable = false;
      try {
        const febBoxId = await showbox.getFebBoxId(id, "2");
        if (febBoxId) {
          details.isAvailable = true;
          details.febBoxId = febBoxId;
          const rootFiles = await febbox.getFileList(febBoxId);

          // Fetch files for all season folders concurrently
          const seasonFolders = rootFiles.filter(
            (f) => f.is_dir && f.name.toLowerCase().includes("season"),
          );
          const seasonFilesPromises = seasonFolders.map((folder) =>
            febbox.getFileList(febBoxId, folder.id),
          );
          const allSeasonFiles = await Promise.all(seasonFilesPromises);

          // Flatten all files from all seasons
          const allFiles = allSeasonFiles.flat();

          // Map file IDs to the episodes
          details.seasons.forEach((season: any) => {
            season.episodes.forEach((episode: any) => {
              // Create a regex to match S01E01, S1E1, etc.
              const sNum = season.season.toString().padStart(2, "0");
              const eNum = episode.episode.toString().padStart(2, "0");
              const pattern = new RegExp(`S${sNum}E${eNum}`, "i");

              const matchedFile = allFiles.find(
                (f) => !f.is_dir && pattern.test(f.name),
              );
              if (matchedFile) {
                episode.fid = matchedFile.id;
                const baseUrl = `${req.protocol}://${req.get("host")}`;
                episode.watch_url = `${baseUrl}/api/febbox/watch/${matchedFile.id}`;
              }
            });
          });
        }
      } catch (err) {
        console.error("Failed to fetch show file IDs:", err);
      }
    }

    res.json(details);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/show", async (req, res) => {
  try {
    res.json(await showbox.getShowDetails("125"));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// --- Lists ---

// Generic list getter
const getList = async (
  res: any,
  listType: "movie" | "tv",
  filter: "featured" | "top",
  page: number,
  pageSize: number,
) => {
  try {
    res.json(await showbox.getMovieList(listType, filter, page, pageSize));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};

// Movies
router.get("/movies/featured", (req, res) =>
  getList(
    res,
    "movie",
    "featured",
    parseInt((req.query.page as string) || "1"),
    parseInt((req.query.pageSize as string) || "20"),
  ),
);
router.get("/movies/top", (req, res) =>
  getList(
    res,
    "movie",
    "top",
    parseInt((req.query.page as string) || "1"),
    parseInt((req.query.pageSize as string) || "20"),
  ),
);

// Series
router.get("/series/featured", (req, res) =>
  getList(
    res,
    "tv",
    "featured",
    parseInt((req.query.page as string) || "1"),
    parseInt((req.query.pageSize as string) || "20"),
  ),
);
router.get("/series/top", (req, res) =>
  getList(
    res,
    "tv",
    "top",
    parseInt((req.query.page as string) || "1"),
    parseInt((req.query.pageSize as string) || "20"),
  ),
);

export default router;
