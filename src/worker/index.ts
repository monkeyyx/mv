import { Hono } from 'hono';
import * as cheerio from 'cheerio';

type Bindings = {
  MYFLIXI_CACHE: KVNamespace;
};

const app = new Hono<{ Bindings: Bindings }>();

// --- Helpers ---

const FEBBOX_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9',
};

async function searchShowbox(keyword: string, type: string = 'all') {
  const url = `https://www.showbox.media/index/search5?keyword=${encodeURIComponent(keyword)}&type=${type}&page=1&pagelimit=20`;
  const res = await fetch(url);
  const data: any = await res.json();
  return data?.data || [];
}

async function getFebBoxId(id: string, type: string) {
  const url = `https://www.showbox.media/index/share_link?id=${id}&type=${type}`;
  const res = await fetch(url);
  const data: any = await res.json();
  return data?.data?.link?.split('/').pop() || null;
}

async function getFebBoxLinks(fid: string) {
  const url = `https://www.febbox.com/console/video_quality_list?fid=${fid}`;
  const res = await fetch(url, {
    headers: {
      ...FEBBOX_HEADERS,
      'x-requested-with': 'XMLHttpRequest',
    },
  });
  const data: any = await res.json();
  const html = data.html || '';
  
  const $ = cheerio.load(html.includes('<tr') ? `<table>${html}</table>` : html);
  const results: any[] = [];
  
  $('tr').each((_, row) => {
    const $row = $(row);
    const quality = $row.find('td').first().text().trim();
    const url = $row.find('a.btn-download').attr('href');
    if (quality && url) {
      results.push({
        url,
        quality,
        label: quality === 'ORG' ? 'Original' : `${quality}p`,
      });
    }
  });

  $('.file_quality').each((_, div) => {
    const $div = $(div);
    const url = $div.attr('data-url');
    const quality = $div.attr('data-quality');
    const size = $div.find('.size').text().trim();
    if (url && quality) {
      results.push({
        url,
        quality,
        size,
        label: quality === 'ORG' ? 'Original Quality' : quality,
      });
    }
  });

  return results;
}

// --- Routes ---

app.get('/resolve/movie', async (c) => {
  const { title, year } = c.req.query();
  if (!title) return c.json({ error: 'Title required' }, 400);

  const cacheKey = `movie:${title.toLowerCase()}:${year || 'any'}`;
  const cached = await c.env.MYFLIXI_CACHE.get(cacheKey);
  if (cached) return c.json(JSON.parse(cached));

  try {
    const results = await searchShowbox(title, '1');
    const match = results.find((r: any) => 
      r.title.toLowerCase() === title.toLowerCase() && (!year || r.year?.toString() === year)
    ) || results[0];

    if (!match) return c.json({ error: 'Movie not found' }, 404);

    const febBoxId = await getFebBoxId(match.id, '1');
    if (!febBoxId) return c.json({ error: 'No stream available' }, 404);

    // Get files and hunt HLS
    const fileListUrl = `https://www.febbox.com/file/file_share_list?share_key=${febBoxId}&pwd=&parent_id=0&is_html=0`;
    const flRes = await fetch(fileListUrl);
    const flData: any = await flRes.json();
    const videoFiles = (flData.data?.file_list || []).filter((f: any) => 
      f.is_dir === 0 && (f.file_name.endsWith('.mp4') || f.file_name.endsWith('.mkv'))
    );

    let finalResult = null;
    for (const file of videoFiles) {
      const rawLinks = await getFebBoxLinks(file.fid);
      const hlsLinks = rawLinks.filter((l: any) => l.url.includes('.m3u8'));
      if (hlsLinks.length > 0) {
        const best = hlsLinks.find((l: any) => l.quality === '1080p') || hlsLinks[0];
        finalResult = {
          title: match.title,
          fid: file.fid,
          stream_sources: rawLinks,
          real_stream_link: best.url,
          is_hls: true
        };
        break;
      }
    }

    if (!finalResult && videoFiles[0]) {
      const rawLinks = await getFebBoxLinks(videoFiles[0].fid);
      finalResult = {
        title: match.title,
        fid: videoFiles[0].fid,
        stream_sources: rawLinks,
        real_stream_link: rawLinks[0]?.url || null,
        is_hls: false
      };
    }

    if (finalResult) {
      await c.env.MYFLIXI_CACHE.put(cacheKey, JSON.stringify(finalResult), { expirationTtl: 43200 });
      return c.json(finalResult);
    }

    return c.json({ error: 'No files found' }, 404);
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

app.get('/resolve/:fid', async (c) => {
  const { fid } = c.req.param();
  
  // 1. Check Cache
  const cached = await c.env.MYFLIXI_CACHE.get(`stream:${fid}`);
  if (cached) return c.json(JSON.parse(cached));

  try {
    const rawLinks = await getFebBoxLinks(fid);
    
    const hlsLinks = rawLinks.filter((l: any) => l.url.includes('.m3u8'));
    const orgLinks = rawLinks.filter((l: any) => !l.url.includes('.m3u8'));

    const best = hlsLinks.find((l: any) => l.quality === '1080p') || hlsLinks[0];
    
    const result = {
      fid,
      isAvailable: rawLinks.length > 0,
      stream_sources: [...hlsLinks, ...orgLinks],
      real_stream_link: best ? best.url : (orgLinks[0]?.url || null),
      is_hls: !!best
    };

    // 2. Cache result for 12 hours
    await c.env.MYFLIXI_CACHE.put(`stream:${fid}`, JSON.stringify(result), { expirationTtl: 43200 });

    return c.json(result);
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

app.get('/status', (c) => c.json({ status: 'Edge Resolver Online' }));

export default app;
