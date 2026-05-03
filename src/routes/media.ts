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
      try {
        const febBoxId = await showbox.getFebBoxId(id, "1");
        if (febBoxId) {
          const files = await febbox.getFileList(febBoxId);
          const videoFiles = files.filter(f => !f.is_dir && (f.name.endsWith('.mp4') || f.name.endsWith('.mkv') || f.name.endsWith('.avi')));
          if (videoFiles.length > 0) {
            details.stream_links = await febbox.getLinks(videoFiles[0].id, febBoxId);
          } else {
            details.stream_links = [];
          }
        }
      } catch (err) {
        console.error("Failed to fetch movie stream links:", err);
      }
    }
    
    res.json(details);
  } catch (e: any) {
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
      try {
        const febBoxId = await showbox.getFebBoxId(id, "2");
        if (febBoxId) {
          details.shareKey = febBoxId;
          const rootFiles = await febbox.getFileList(febBoxId);
          
          // Fetch files for all season folders concurrently
          const seasonFolders = rootFiles.filter(f => f.is_dir && f.name.toLowerCase().includes("season"));
          const seasonFilesPromises = seasonFolders.map(folder => febbox.getFileList(febBoxId, folder.id));
          const allSeasonFiles = await Promise.all(seasonFilesPromises);
          
          // Flatten all files from all seasons
          const allFiles = allSeasonFiles.flat();
          
          // Map file IDs to the episodes
          details.seasons.forEach((season: any) => {
            season.episodes.forEach((episode: any) => {
              // Create a regex to match S01E01, S1E1, etc.
              const sNum = season.season.toString().padStart(2, '0');
              const eNum = episode.episode.toString().padStart(2, '0');
              const pattern = new RegExp(`S${sNum}E${eNum}`, 'i');
              
              const matchedFile = allFiles.find(f => !f.is_dir && pattern.test(f.name));
              if (matchedFile) {
                episode.fid = matchedFile.id;
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
