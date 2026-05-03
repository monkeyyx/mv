import { Hono } from "hono";
import type { Bindings, Variables } from "../types";
import { ShowboxService } from "../../core/services/ShowboxService";
import { FebBoxService } from "../../core/services/FebBoxService";
import type { StreamSource, Movie } from "../../core/types";

const media = new Hono<{ Bindings: Bindings; Variables: Variables }>();
const showbox = new ShowboxService();
const febbox = new FebBoxService();

media.use("*", async (c, next) => {
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

media.get("/movie/:id", async (c) => {
  const id = c.req.param("id");
  const details = await showbox.getMovieDetails(id);
  if (!details) return c.json({ error: "Movie not found" }, 404);

  // Modular Hono logic for stream resolution
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
            // Provide the working proxy URL as the primary hls_url
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

  return c.json(mutableDetails);
});

// --- HLS Proxy ---
// FebBox locks stream tokens to the SERVER's IP (the IP that made the API request).
// Browsers have a different public IP so direct playback fails with 403.
// This proxy forwards the request from the same server IP that generated the token.
media.get('/stream/:id', async (c) => {
  const id = c.req.param('id');

  // Resolve stream URL
  let hlsUrl = '';
  try {
    const febBoxId = await showbox.getFebBoxId(id, '1');
    if (febBoxId) {
      const files = await febbox.getFileList(febBoxId);
      const videoFiles = files.filter(f => !f.is_dir);
      for (const file of videoFiles) {
        const rawLinks = await febbox.getLinks(file.id, febBoxId);
        const hlsLink = rawLinks.find(l => l.url.includes('.m3u8'));
        if (hlsLink) { hlsUrl = hlsLink.url; break; }
      }
    }
  } catch (e) {}

  if (!hlsUrl) return c.json({ error: 'No stream found' }, 404);

  // Fetch the .m3u8 playlist from the server (same IP that signed the token)
  const upstream = await fetch(hlsUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://www.febbox.com/' },
  });

  if (!upstream.ok) {
    return c.json({ error: `Upstream error: ${upstream.status}` }, 502);
  }

  const playlist = await upstream.text();

  // Rewrite segment URLs in the playlist to go through our proxy
  const baseUrl = new URL(hlsUrl);
  const segmentBase = `${baseUrl.protocol}//${baseUrl.host}${baseUrl.pathname.substring(0, baseUrl.pathname.lastIndexOf('/') + 1)}`;

  const rewritten = playlist.split('\n').map(line => {
    if (line.startsWith('#') || line.trim() === '') return line;
    // Absolute URL segments
    if (line.startsWith('http')) {
      return `/api/media/segment?url=${encodeURIComponent(line.trim())}`;
    }
    // Relative URL segments — resolve against base
    return `/api/media/segment?url=${encodeURIComponent(segmentBase + line.trim())}`;
  }).join('\n');

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
  const details = await showbox.getShowDetails(id);
  if (!details) return c.json({ error: "Show not found" }, 404);
  return c.json(details);
});

export default media;
