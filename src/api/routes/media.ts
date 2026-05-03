import { Hono } from "hono";
import type { Bindings, Variables } from "../types";
import { ShowboxService } from "../../core/services/ShowboxService";
import { FebBoxService } from "../../core/services/FebBoxService";
import type { StreamSource, Movie } from "../../core/types";

const media = new Hono<{ Bindings: Bindings; Variables: Variables }>();
const showbox = new ShowboxService();
const febbox = new FebBoxService();

media.use("*", async (c, next) => {
  // Inject Durable Object session and environment for automated login
  (febbox as any).sessionDO = c.env.FEBBOX_SESSION;
  (febbox as any).env = c.env;
  febbox.uiCookie = c.env.FEBBOX_UI_COOKIE;
  await next();
});

media.get("/autocomplete", async (c) => {
  const keyword = c.req.query("keyword") || "Avatar";
  const results = await showbox.autocomplete(keyword);
  return c.json(results);
});

media.get("/search", async (c) => {
  const q = c.req.query("title") || c.req.query("keyword") || "Avatar";
  const type = c.req.query("type") || "all";
  console.log(`[MediaRoute] Searching for ${q} (${type})...`);
  const results = await showbox.search(q, type);
  console.log(`[MediaRoute] Found ${results.length} results.`);
  return c.json(results);
});

import { requestManager } from "../../core/utils/RequestManager";

media.get("/movie/:id", async (c) => {
  const id = c.req.param("id");
  const cache = c.var.cache;
  const cacheKey = `media:movie:${id}`;

  // 1. Check Cache
  const { value: cached, isStale } = await cache.getWithMetadata<Movie>(cacheKey);
  if (cached) {
    c.header("X-Cache", isStale ? "STALE" : "HIT");
    // Background refresh omitted here for simplicity, but could be added like discover.ts
    return c.json(cached);
  }

  c.header("X-Cache", "MISS");

  // Use RequestManager to prevent double-fetches
  const result = await requestManager.run(cacheKey, async () => {
    const details = await showbox.getMovieDetails(id);
    if (!details) return null;

    const mutableDetails = JSON.parse(JSON.stringify(details)) as Movie & {
      stream_sources: StreamSource[];
      hls_url?: string;
    };
    mutableDetails.stream_sources = [];
    mutableDetails.isAvailable = false;

    try {
      const febBoxId = await showbox.getFebBoxId(id, "1");
      if (febBoxId) {
        mutableDetails.isAvailable = true;
        const files = await febbox.getFileList(febBoxId);
        const videoFiles = files.filter(
          (f) =>
            !f.is_dir &&
            (f.name.endsWith(".mp4") ||
              f.name.endsWith(".mkv") ||
              f.name.endsWith(".avi")),
        );

        if (videoFiles.length > 0) {
          let foundHls = false;
          for (const file of videoFiles) {
            if (foundHls) break;
            const rawLinks = await febbox.getLinks(file.id, febBoxId);
            const hlsLinks = rawLinks.filter((l) => l.url.includes(".m3u8"));
            const orgLinks = rawLinks.filter((l) => !l.url.includes(".m3u8"));

            if (hlsLinks.length > 0) {
              foundHls = true;
              mutableDetails.stream_sources = [...hlsLinks, ...orgLinks];
              mutableDetails.hls_url = `/api/media/stream/${id}`;
            }
          }

          if (!foundHls) {
            const firstFile = videoFiles[0];
            const rawLinks = await febbox.getLinks(firstFile.id, febBoxId);
            mutableDetails.stream_sources = rawLinks;
          }
        }
      }
    } catch (e: unknown) {
      console.error("Resolution failed:", (e as Error).message);
    }

    // Store in Cache (1 hour fresh, 24 hours SWR)
    await cache.set(cacheKey, mutableDetails, 3600, 86400);
    return mutableDetails;
  });

  if (!result) return c.json({ error: "Movie not found" }, 404);
  return c.json(result);
});

// --- HLS Proxy ---
// FebBox locks stream tokens to the SERVER's IP (the IP that made the API request).
// Browsers have a different public IP so direct playback fails with 403.
// This proxy forwards the request from the same server IP that generated the token.
media.get('/stream/:id', async (c) => {
  const id = c.req.param('id');
  const cache = c.var.cache;
  const cacheKey = `media:stream_url:${id}`;
  const playlistCacheKey = `media:playlist:${id}`;

  // 1. Check if we have a cached rewritten playlist (Fast Path)
  const cachedPlaylist = await cache.get<string>(playlistCacheKey);
  if (cachedPlaylist) {
    c.header("X-Cache", "HIT");
    return new Response(cachedPlaylist, {
      headers: {
        'Content-Type': 'application/vnd.apple.mpegurl',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  // 2. Resolve stream URL (Check Cache First)
  let hlsUrl = await cache.get<string>(cacheKey) || '';

  if (!hlsUrl) {
    try {
      const result = await requestManager.run(cacheKey, async () => {
        const febBoxId = await showbox.getFebBoxId(id, '1');
        if (febBoxId) {
          const files = await febbox.getFileList(febBoxId);
          const videoFiles = files.filter(f => !f.is_dir);
          for (const file of videoFiles) {
            const rawLinks = await febbox.getLinks(file.id, febBoxId);
            const hlsLink = rawLinks.find(l => l.url.includes('.m3u8'));
            if (hlsLink) {
              return hlsLink.url;
            }
          }
        }
        return null;
      });
      if (result) {
        hlsUrl = result;
        await cache.set(cacheKey, hlsUrl, 21600); // 6 hours
      }
    } catch (e) {}
  }

  if (!hlsUrl) return c.json({ error: 'No stream found' }, 404);

  // 3. Fetch and Rewrite (Coalesced)
  c.header("X-Cache", "MISS");
  const rewritten = await requestManager.run(`rewrite:${id}`, async () => {
    const upstream = await fetch(hlsUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://www.febbox.com/' },
    });

    if (!upstream.ok) return null;

    const playlist = await upstream.text();
    const baseUrl = new URL(hlsUrl);
    const segmentBase = `${baseUrl.protocol}//${baseUrl.host}${baseUrl.pathname.substring(0, baseUrl.pathname.lastIndexOf('/') + 1)}`;

    const content = playlist.split('\n').map(line => {
      if (line.startsWith('#') || line.trim() === '') return line;
      if (line.startsWith('http')) {
        return `/api/media/segment?url=${encodeURIComponent(line.trim())}`;
      }
      return `/api/media/segment?url=${encodeURIComponent(segmentBase + line.trim())}`;
    }).join('\n');

    // Cache rewritten playlist for 10 minutes
    await cache.set(playlistCacheKey, content, 600);
    return content;
  });

  if (!rewritten) return c.json({ error: 'Upstream error' }, 502);

  return new Response(rewritten, {
    headers: {
      'Content-Type': 'application/vnd.apple.mpegurl',
      'Access-Control-Allow-Origin': '*',
    },
  });
});

// Proxy individual HLS segments (.ts files)
media.get('/segment', async (c) => {
  const url = c.req.query('url');
  if (!url) return c.json({ error: 'Missing url param' }, 400);

  const upstream = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://www.febbox.com/' },
  });

  if (!upstream.ok) return c.json({ error: `Segment fetch failed: ${upstream.status}` }, 502);

  return new Response(upstream.body, {
    headers: {
      'Content-Type': upstream.headers.get('Content-Type') || 'video/MP2T',
      'Access-Control-Allow-Origin': '*',
    },
  });
});

// --- Browser Player ---
// Points to our server-side HLS proxy so the IP-locked token always matches
media.get('/play/:id', async (c) => {
  const id = c.req.param('id');
  const details = await showbox.getMovieDetails(id);
  if (!details) return c.html('<h1>Movie not found</h1>', 404);

  const proxyUrl = `/api/media/stream/${id}`;

  return c.html(`<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <title>${details.title} — MyFlixi Player</title>
    <script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script>
    <style>
      *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
      body { background: #0d0d0d; color: #fff; font-family: system-ui, sans-serif; height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; }
      h1 { font-size: 1.2rem; margin-bottom: 12px; color: #ccc; }
      video { width: 100%; max-width: 1100px; border-radius: 10px; box-shadow: 0 0 40px rgba(0,0,0,0.8); }
      #status { margin-top: 12px; font-size: 0.8rem; color: #888; }
    </style>
  </head>
  <body>
    <h1>▶ ${details.title} ${details.year ? `(${details.year})` : ''}</h1>
    <video id="video" controls autoplay></video>
    <p id="status">Loading stream…</p>
    <script>
      const video = document.getElementById('video');
      const status = document.getElementById('status');
      const src = '${proxyUrl}';
      if (Hls.isSupported()) {
        const hls = new Hls({ enableWorker: true });
        hls.on(Hls.Events.MANIFEST_PARSED, () => { status.textContent = 'Stream ready'; video.play(); });
        hls.on(Hls.Events.ERROR, (_, d) => { if (d.fatal) status.textContent = 'Stream error: ' + d.details; });
        hls.loadSource(src);
        hls.attachMedia(video);
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = src;
        status.textContent = 'Native HLS';
      } else {
        status.textContent = 'HLS not supported in this browser.';
      }
    </script>
  </body>
</html>`);
});

media.get("/show/:id", async (c) => {
  const id = c.req.param("id");
  const cache = c.var.cache;
  const cacheKey = `media:show:${id}`;

  const { value: cached, isStale } = await cache.getWithMetadata(cacheKey);
  if (cached) {
    c.header("X-Cache", isStale ? "STALE" : "HIT");
    return c.json(cached);
  }

  c.header("X-Cache", "MISS");

  const result = await requestManager.run(cacheKey, async () => {
    const details = await showbox.getShowDetails(id);
    if (!details) return null;
    await cache.set(cacheKey, details, 3600, 86400);
    return details;
  });

  if (!result) return c.json({ error: "Show not found" }, 404);
  return c.json(result);
});

export default media;
