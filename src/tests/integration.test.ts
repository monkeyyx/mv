/**
 * Full Integration Test — Showbox + FebBox Pipeline
 * Mirrors the original manual test script but using bun:test.
 *
 * Run: bun test src/tests/test.ts
 */
import { describe, it, expect } from "bun:test";
import { ShowboxService } from "../core/services/ShowboxService";
import { FebBoxService } from "../core/services/FebBoxService";

const showbox = new ShowboxService();
const febbox = new FebBoxService();
// Pull cookie from env if present (needed for private FebBox endpoints)
febbox.uiCookie = process.env.FEBBOX_UI_COOKIE;

// ---------------------------------------------------------------------------
// Movie: Ratatouille
// ---------------------------------------------------------------------------
describe("🎬 Movie Pipeline — Ratatouille", () => {
  let movieShowboxId = "";
  let febBoxId: string | null = null;

  it("should find Ratatouille in ShowBox", async () => {
    const results = await showbox.search("ratatouille", "movie");
    console.log("Search results:", results.slice(0, 3));
    expect(results.length).toBeGreaterThan(0);

    const movie = results[0];
    expect(movie.title.toLowerCase()).toContain("ratatouille");
    expect(movie.id).toBeTruthy();
    movieShowboxId = movie.id;
    console.log("🎬 Movie:", movie);
  });

  it("should resolve FebBox share ID for the movie", async () => {
    febBoxId = await showbox.getFebBoxId(movieShowboxId, "1");
    console.log("🔗 FebBox ID:", febBoxId);
    expect(febBoxId).toBeTruthy();
  });

  it("should list files in FebBox folder", async () => {
    if (!febBoxId) return;
    const files = await febbox.getFileList(febBoxId);
    console.log("📂 File List:", files);
    expect(files.length).toBeGreaterThan(0);
  });

  it("should get stream links for first video file", async () => {
    if (!febBoxId) return;
    const files = await febbox.getFileList(febBoxId);
    const videoFile = files.find((f) => !f.is_dir);
    if (!videoFile) {
      console.warn("⚠️ No video file found — skipping link test");
      return;
    }
    const links = await febbox.getLinks(videoFile.id, febBoxId);
    console.log("🌐 Stream Links:", links);
    expect(links.length).toBeGreaterThan(0);
    expect(links[0].url).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// TV Show: Breaking Bad
// ---------------------------------------------------------------------------
describe("📺 TV Show Pipeline — Breaking Bad", () => {
  let showShowboxId = "";
  let febBoxId: string | null = null;

  it("should find Breaking Bad in ShowBox", async () => {
    const results = await showbox.search("breaking bad", "tv");
    console.log("Search results:", results.slice(0, 3));
    expect(results.length).toBeGreaterThan(0);

    const show = results[0];
    expect(show.title.toLowerCase()).toContain("breaking");
    expect(show.id).toBeTruthy();
    showShowboxId = show.id;
    console.log("📺 Show:", show);
  });

  it("should get show details with seasons and episodes", async () => {
    const details = await showbox.getShowDetails(showShowboxId);
    console.log("📜 Show Details:", JSON.stringify(details, null, 2));
    expect(details).not.toBeNull();
    expect(details?.seasons?.length).toBeGreaterThan(0);
  });

  it("should resolve FebBox share ID for the show", async () => {
    febBoxId = await showbox.getFebBoxId(showShowboxId, "2");
    console.log("🔗 FebBox ID:", febBoxId);
    expect(febBoxId).toBeTruthy();
  });

  it("should list top-level folder contents", async () => {
    if (!febBoxId) return;
    const files = await febbox.getFileList(febBoxId);
    console.log("📂 File List:", files);
    expect(files.length).toBeGreaterThan(0);
  });

  it("should drill into a season folder and get episode links", async () => {
    if (!febBoxId) return;
    const files = await febbox.getFileList(febBoxId);
    const seasonDir = files.find((f) => f.is_dir);

    if (!seasonDir) {
      console.warn("⚠️ No season directory found — skipping");
      return;
    }

    console.log("📂 Season Folder:", seasonDir);
    const seasonFiles = await febbox.getFileList(febBoxId, seasonDir.id);
    console.log("📂 Season Files:", seasonFiles);
    expect(seasonFiles.length).toBeGreaterThan(0);

    // Get links for first episode
    const episode = seasonFiles.find((f) => !f.is_dir);
    if (!episode) return;

    const links = await febbox.getLinks(episode.id, febBoxId);
    console.log("🌐 Episode Links:", links);
    expect(links.length).toBeGreaterThan(0);
    expect(links[0].url).toContain("http");
  });
});

// ---------------------------------------------------------------------------
// Anime / Japanese Discovery
// ---------------------------------------------------------------------------
import { TMDBService } from "../core/services/TMDBService";

const tmdb = new TMDBService();

describe("🇯🇵 Anime Discovery Pipeline", () => {
  it("should fetch Japanese animated shows from TMDB (genre=16, language=ja)", async () => {
    tmdb.apiKey = process.env.TMDB_API_KEY ?? "";
    const results = await tmdb.getAnime(1);
    console.log(
      "📺 TMDB Anime results (first 5):",
      results.slice(0, 5).map((r) => `${r.title} (${r.year})`)
    );
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].title).toBeTruthy();
  });

  it("should find known anime on ShowBox — Attack on Titan", async () => {
    const results = await showbox.search("attack on titan", "tv");
    console.log("ShowBox results:", results.slice(0, 3));
    expect(results.length).toBeGreaterThan(0);
    const found = results.find((r) =>
      r.title.toLowerCase().includes("titan")
    );
    expect(found).toBeTruthy();
    console.log("✅ Found on ShowBox:", found);
  });

  it("should find known anime on ShowBox — Demon Slayer", async () => {
    const results = await showbox.search("demon slayer", "tv");
    console.log("ShowBox results:", results.slice(0, 3));
    expect(results.length).toBeGreaterThan(0);
    console.log("✅ Found on ShowBox:", results[0]);
  });

  it("should cross-check TMDB anime page 1 against ShowBox availability", async () => {
    tmdb.apiKey = process.env.TMDB_API_KEY ?? "";
    const animeList = await tmdb.getAnime(1);

    // Check first 5 only — each needs a ShowBox network call
    const sample = animeList.slice(0, 5);
    const available: string[] = [];
    const unavailable: string[] = [];

    for (const item of sample) {
      const matches = await showbox.search(item.title, "all", item.year);
      const found = matches.find((r) => {
        const a = item.title.toLowerCase().replace(/[^a-z0-9]/g, "");
        const b = r.title.toLowerCase().replace(/[^a-z0-9]/g, "");
        return b.includes(a) || a.includes(b);
      });
      if (found) {
        available.push(`✅ ${item.title} → showbox_id: ${found.id}`);
      } else {
        unavailable.push(`❌ ${item.title}`);
      }
    }

    console.log("\n📊 Anime Availability Report:");
    console.log("Available on ShowBox:\n ", available.join("\n  ") || "none");
    console.log("Not found:\n ", unavailable.join("\n  ") || "none");

    // At least some should be available — ShowBox has major anime
    expect(available.length).toBeGreaterThan(0);
  });
});
