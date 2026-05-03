import { Router } from "express";
import { FebBoxService } from "../services/FebBoxService";
import { Readable } from "stream";
import { config } from "../utils/config";

const router = Router();
const febbox = new FebBoxService();
const port = config.API_PORT;

// --- Personal Console ---

router.get("/folder/id/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { uid } = req.query; // Optional UID for shared folders
    const files = await febbox.getConsoleFileList(id, uid as string);
    res.json({ folder_id: id, files });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get("/folder/:name", async (req, res) => {
  try {
    const { name } = req.params;
    
    // 1. Handle Root
    if (name.toLowerCase() === "root") {
      const files = await febbox.getConsoleFileList();
      return res.json({ folder: "Root", files });
    }

    // 2. Try to find in Root first
    const root = await febbox.getConsoleFileList();
    let target = root.find(f => f.name.toLowerCase() === name.toLowerCase() && f.is_dir);
    
    // 3. If not in root, try a quick console search to find the folder's metadata
    if (!target) {
      const searchResults = await febbox.searchConsole(name);
      target = searchResults.find(f => f.name.toLowerCase() === name.toLowerCase() && f.is_dir);
    }

    if (!target) {
      return res.status(404).json({ error: "Folder not found", files: [] });
    }

    const files = await febbox.getConsoleFileList(target.id, target.from_uid);
    res.json({ folder: target.name, files });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get("/console/search", async (req, res) => {
  try {
    const q = (req.query.q as string) || "Avatar";
    res.json(await febbox.searchConsole(q));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get("/watch/:fid", async (req, res) => {
  try {
    const { fid } = req.params;
    const links = await febbox.getConsoleLinks(fid);
    const baseUrl = `${req.protocol}://${req.get("host")}`;

    const hlsLinks = links.filter((l) => l.url.includes(".m3u8"));
    const orgLinks = links.filter((l) => !l.url.includes(".m3u8"));

    const sources = [...hlsLinks, ...orgLinks].map((l) => ({
      quality: l.quality,
      label: l.label,
      size: l.size,
      is_hls: l.url.includes(".m3u8"),
      direct_url: l.url,
      stream_url: `${baseUrl}/api/febbox/stream/${fid}?quality=${l.quality}`,
    }));

    // Pick best HLS for the shortcut link
    const best = hlsLinks.find((l) => l.quality === "1080p") || hlsLinks[0];

    res.json({
      fid,
      isAvailable: sources.length > 0,
      stream_sources: sources,
      real_stream_link: best ? `${baseUrl}/api/febbox/stream/${fid}?quality=${best.quality}` : null,
      hls_url: best ? best.url : null
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/stream/:fid", async (req, res) => {
  try {
    const { fid } = req.params;
    const { quality } = req.query;
    const links = await febbox.getConsoleLinks(fid);
    const source = links.find(l => l.quality === quality) || links.find(l => l.quality === "ORG") || links[0];
    if (!source) throw new Error("Stream source not found");

    const response = await fetch(source.url, {
      headers: { "User-Agent": "Mozilla/5.0", "Referer": "https://www.febbox.com/", ...(req.headers.range ? { Range: req.headers.range } : {}) }
    });

    res.status(response.status);
    res.setHeader("Content-Type", "video/mp4");
    ["content-range", "accept-ranges", "content-length"].forEach(h => {
      if (response.headers.get(h)) res.setHeader(h, response.headers.get(h)!);
    });

    if (response.body) {
      // @ts-ignore - Bun's ReadableStream is compatible
      Readable.fromWeb(response.body).pipe(res);
    }
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// --- Public Shared ---

router.get("/files", async (req, res) => {
  try {
    const { shareKey = "fNBTg8at", parent_id = "0" } = req.query;
    res.json(await febbox.getFileList(shareKey as string, parent_id as string));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get("/links", async (req, res) => {
  try {
    const { shareKey = "fNBTg8at", fid = "2636650" } = req.query;
    res.json(await febbox.getPublicLinks(shareKey as string, fid as string));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
