export const openApiSpec = {
  openapi: "3.0.0",
  info: {
    title: "MyFlixi API",
    version: "2.2.0",
    description:
      "Modular, edge-ready Hono API for movie & TV discovery, stream resolution, and FebBox file browsing.\n\n" +
      "## How it works\n" +
      "1. **Discover** — Use TMDB to get curated lists (popular, top-rated, genre, language)\n" +
      "2. **Availability Check** — Every discovery result is cross-checked against ShowBox\n" +
      "3. **Stream** — Resolve a `showbox_id` to FebBox HLS/MP4 links via `/api/media/stream/:id`\n\n" +
      "## Quick Start\n" +
      "```\nGET /api/discover/shows/anime        # Japanese anime available on ShowBox\nGET /api/media/stream/168            # Proxied HLS stream for Attack on Titan\nGET /api/media/play/168              # Browser player\n```",
    contact: { name: "MyFlixi", url: "https://github.com/IronKern/show_feb_box_api-myflixi-fork" },
  },
  tags: [
    { name: "System", description: "API health and status" },
    { name: "Discover", description: "TMDB-powered discovery, filtered to ShowBox-available content" },
    { name: "Media", description: "Search, details, and HLS stream resolution" },
    { name: "FebBox", description: "Direct FebBox file browsing and stream links" },
  ],
  components: {
    schemas: {
      Movie: {
        type: "object",
        properties: {
          id: { type: "string", example: "168", description: "ShowBox internal ID" },
          title: { type: "string", example: "Attack on Titan" },
          poster: { type: "string", format: "uri", example: "https://image.tmdb.org/t/p/w500/..." },
          year: { type: "string", example: "2013" },
          rating: { type: "string", example: "9.1" },
          box_type: { type: "number", enum: [1, 2], description: "1 = Movie, 2 = TV Show" },
          isAvailable: { type: "boolean", description: "True if found on ShowBox" },
          showbox_id: { type: "string", description: "ShowBox ID (same as id for search results)" },
          stream_url: { type: "string", description: "Proxied HLS playlist — use this in your player" },
          play_url: { type: "string", description: "Browser player URL" },
        },
      },
      StreamSource: {
        type: "object",
        properties: {
          url: { type: "string", format: "uri", description: "Direct stream URL (HLS .m3u8 or MP4)" },
          quality: { type: "string", example: "1080p", enum: ["ORG", "1080p", "720p", "360p"] },
          label: { type: "string", example: "1080p" },
          size: { type: "string", example: "2.34 GB" },
        },
      },
      FileItem: {
        type: "object",
        properties: {
          id: { type: "string", example: "2636584" },
          name: { type: "string", example: "Breaking.Bad.S01E01.1080p.mkv" },
          is_dir: { type: "boolean" },
          size: { type: "string", example: "2.01 GB" },
          type: { type: "string" },
        },
      },
      MovieDetail: {
        allOf: [
          { $ref: "#/components/schemas/Movie" },
          {
            type: "object",
            properties: {
              hls_url: { type: "string", format: "uri", description: "Best HLS URL (use /api/media/stream/:id for proxy)" },
              stream_sources: { type: "array", items: { $ref: "#/components/schemas/StreamSource" } },
            },
          },
        ],
      },
      ShowDetails: {
        allOf: [
          { $ref: "#/components/schemas/Movie" },
          {
            type: "object",
            properties: {
              seasons: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    season: { type: "number", example: 1 },
                    episodes: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          episode: { type: "number" },
                          title: { type: "string" },
                          id: { type: "string" },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        ],
      },
      Genre: {
        type: "object",
        properties: {
          id: { type: "number", example: 16 },
          name: { type: "string", example: "Animation" },
        },
      },
      DiscoverResponse: {
        type: "object",
        properties: {
          page: { type: "number", example: 1 },
          total: { type: "number", example: 8, description: "Number of ShowBox-available results on this page" },
          results: { type: "array", items: { $ref: "#/components/schemas/Movie" } },
        },
      },
      ErrorResponse: {
        type: "object",
        properties: {
          error: { type: "string" },
          message: { type: "string" },
        },
      },
    },
    parameters: {
      page: { name: "page", in: "query", schema: { type: "integer", default: 1, minimum: 1 }, description: "Page number" },
      showboxId: { name: "id", in: "path", required: true, schema: { type: "string" }, description: "ShowBox ID", example: "168" },
    },
  },
  paths: {
    "/api/system/status": {
      get: {
        tags: ["System"],
        summary: "Health Check",
        description: "Returns the current status of the API and its service dependencies.",
        responses: {
          "200": {
            description: "API is online",
            content: {
              "application/json": {
                example: { status: "online", version: "2.2.0", services: { showbox: "ok", tmdb: "ok" } },
              },
            },
          },
        },
      },
    },
    "/api/discover/movies/popular": {
      get: {
        tags: ["Discover"],
        summary: "Popular Movies",
        description: "TMDB popular movies filtered to ShowBox-available titles only.",
        parameters: [{ $ref: "#/components/parameters/page" }],
        responses: { "200": { description: "List of available movies", content: { "application/json": { schema: { $ref: "#/components/schemas/DiscoverResponse" } } } } },
      },
    },
    "/api/discover/movies/top_rated": {
      get: {
        tags: ["Discover"],
        summary: "Top Rated Movies",
        parameters: [{ $ref: "#/components/parameters/page" }],
        responses: { "200": { description: "OK", content: { "application/json": { schema: { $ref: "#/components/schemas/DiscoverResponse" } } } } },
      },
    },
    "/api/discover/movies/now_playing": {
      get: {
        tags: ["Discover"],
        summary: "Now Playing",
        description: "Movies currently in cinemas, available on ShowBox.",
        parameters: [{ $ref: "#/components/parameters/page" }],
        responses: { "200": { description: "OK", content: { "application/json": { schema: { $ref: "#/components/schemas/DiscoverResponse" } } } } },
      },
    },
    "/api/discover/movies/upcoming": {
      get: {
        tags: ["Discover"],
        summary: "Upcoming Movies",
        parameters: [{ $ref: "#/components/parameters/page" }],
        responses: { "200": { description: "OK", content: { "application/json": { schema: { $ref: "#/components/schemas/DiscoverResponse" } } } } },
      },
    },
    "/api/discover/movies/animation": {
      get: { tags: ["Discover"], summary: "Animation Movies", parameters: [{ $ref: "#/components/parameters/page" }], responses: { "200": { description: "OK", content: { "application/json": { schema: { $ref: "#/components/schemas/DiscoverResponse" } } } } } },
    },
    "/api/discover/movies/action": {
      get: { tags: ["Discover"], summary: "Action Movies", parameters: [{ $ref: "#/components/parameters/page" }], responses: { "200": { description: "OK", content: { "application/json": { schema: { $ref: "#/components/schemas/DiscoverResponse" } } } } } },
    },
    "/api/discover/movies/horror": {
      get: { tags: ["Discover"], summary: "Horror Movies", parameters: [{ $ref: "#/components/parameters/page" }], responses: { "200": { description: "OK", content: { "application/json": { schema: { $ref: "#/components/schemas/DiscoverResponse" } } } } } },
    },
    "/api/discover/movies/scifi": {
      get: { tags: ["Discover"], summary: "Sci-Fi Movies", parameters: [{ $ref: "#/components/parameters/page" }], responses: { "200": { description: "OK", content: { "application/json": { schema: { $ref: "#/components/schemas/DiscoverResponse" } } } } } },
    },
    "/api/discover/movies/comedy": {
      get: { tags: ["Discover"], summary: "Comedy Movies", parameters: [{ $ref: "#/components/parameters/page" }], responses: { "200": { description: "OK", content: { "application/json": { schema: { $ref: "#/components/schemas/DiscoverResponse" } } } } } },
    },
    "/api/discover/movies": {
      get: {
        tags: ["Discover"],
        summary: "Discover Movies (Custom Filter)",
        description: "Flexible TMDB movie discovery with genre, language, and sort filters.",
        parameters: [
          { $ref: "#/components/parameters/page" },
          { name: "genre", in: "query", schema: { type: "string" }, description: "TMDB genre ID (e.g. 28 = Action, 35 = Comedy, 16 = Animation, 878 = Sci-Fi)", example: "28" },
          { name: "language", in: "query", schema: { type: "string" }, description: "ISO 639-1 original language code", example: "ja" },
          { name: "sort", in: "query", schema: { type: "string", enum: ["popularity.desc", "vote_average.desc", "release_date.desc"], default: "popularity.desc" } },
          { name: "min_rating", in: "query", schema: { type: "number", minimum: 0, maximum: 10 }, example: 7 },
        ],
        responses: { "200": { description: "OK", content: { "application/json": { schema: { $ref: "#/components/schemas/DiscoverResponse" } } } } },
      },
    },
    "/api/discover/shows/popular": {
      get: { tags: ["Discover"], summary: "Popular TV Shows", parameters: [{ $ref: "#/components/parameters/page" }], responses: { "200": { description: "OK", content: { "application/json": { schema: { $ref: "#/components/schemas/DiscoverResponse" } } } } } },
    },
    "/api/discover/shows/top_rated": {
      get: { tags: ["Discover"], summary: "Top Rated TV Shows", parameters: [{ $ref: "#/components/parameters/page" }], responses: { "200": { description: "OK", content: { "application/json": { schema: { $ref: "#/components/schemas/DiscoverResponse" } } } } } },
    },
    "/api/discover/shows/airing_today": {
      get: { tags: ["Discover"], summary: "Airing Today", parameters: [{ $ref: "#/components/parameters/page" }], responses: { "200": { description: "OK", content: { "application/json": { schema: { $ref: "#/components/schemas/DiscoverResponse" } } } } } },
    },
    "/api/discover/shows/anime": {
      get: {
        tags: ["Discover"],
        summary: "🇯🇵 Anime",
        description: "Japanese animated TV shows (TMDB genre 16 + language `ja`), filtered to ShowBox-available titles.",
        parameters: [{ $ref: "#/components/parameters/page" }],
        responses: { "200": { description: "OK", content: { "application/json": { schema: { $ref: "#/components/schemas/DiscoverResponse" } } } } },
      },
    },
    "/api/discover/shows/korean": {
      get: {
        tags: ["Discover"],
        summary: "🇰🇷 Korean Dramas",
        description: "Korean-language TV shows available on ShowBox.",
        parameters: [{ $ref: "#/components/parameters/page" }],
        responses: { "200": { description: "OK", content: { "application/json": { schema: { $ref: "#/components/schemas/DiscoverResponse" } } } } },
      },
    },
    "/api/discover/shows": {
      get: {
        tags: ["Discover"],
        summary: "Discover Shows (Custom Filter)",
        parameters: [
          { $ref: "#/components/parameters/page" },
          { name: "genre", in: "query", schema: { type: "string" }, description: "TMDB genre ID (16 = Animation, 18 = Drama, 10765 = Sci-Fi & Fantasy)", example: "16" },
          { name: "language", in: "query", schema: { type: "string" }, example: "ja", description: "ISO 639-1 original language (ja, ko, fr…)" },
          { name: "sort", in: "query", schema: { type: "string", enum: ["popularity.desc", "vote_average.desc", "first_air_date.desc"], default: "popularity.desc" } },
          { name: "min_rating", in: "query", schema: { type: "number" }, example: 8 },
        ],
        responses: { "200": { description: "OK", content: { "application/json": { schema: { $ref: "#/components/schemas/DiscoverResponse" } } } } },
      },
    },
    "/api/discover/genres/movies": {
      get: {
        tags: ["Discover"],
        summary: "Movie Genre List",
        description: "All TMDB movie genres with their IDs for use in the `/api/discover/movies` filter.",
        responses: {
          "200": {
            description: "OK",
            content: { "application/json": { schema: { type: "object", properties: { genres: { type: "array", items: { $ref: "#/components/schemas/Genre" } } } }, example: { genres: [{ id: 28, name: "Action" }, { id: 16, name: "Animation" }] } } },
          },
        },
      },
    },
    "/api/discover/genres/shows": {
      get: {
        tags: ["Discover"],
        summary: "TV Show Genre List",
        responses: { "200": { description: "OK", content: { "application/json": { schema: { type: "object", properties: { genres: { type: "array", items: { $ref: "#/components/schemas/Genre" } } } } } } } },
      },
    },
    "/api/media/search": {
      get: {
        tags: ["Media"],
        summary: "Search ShowBox",
        description: "Search ShowBox directly for movies or TV shows by title.",
        parameters: [
          { name: "title", in: "query", required: true, schema: { type: "string" }, example: "Attack on Titan" },
          { name: "type", in: "query", schema: { type: "string", enum: ["movie", "tv", "all"], default: "all" } },
        ],
        responses: { "200": { description: "Search results", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Movie" } } } } } },
      },
    },
    "/api/media/autocomplete": {
      get: {
        tags: ["Media"],
        summary: "Autocomplete Search",
        parameters: [{ name: "keyword", in: "query", required: true, schema: { type: "string" }, example: "avatar" }],
        responses: { "200": { description: "List of title suggestions", content: { "application/json": { schema: { type: "array", items: { type: "string" } } } } } },
      },
    },
    "/api/media/movie/{id}": {
      get: {
        tags: ["Media"],
        summary: "Movie Details + Stream Links",
        description: "Returns full movie metadata plus resolved FebBox stream sources (HLS + MP4).\n\n> ⚠️ HLS links are IP-locked to the server. Use `/api/media/stream/{id}` instead of the raw `hls_url` in client apps.",
        parameters: [{ $ref: "#/components/parameters/showboxId" }],
        responses: {
          "200": { description: "Movie details with stream sources", content: { "application/json": { schema: { $ref: "#/components/schemas/MovieDetail" } } } },
          "404": { description: "Movie not found", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
        },
      },
    },
    "/api/media/show/{id}": {
      get: {
        tags: ["Media"],
        summary: "TV Show Details",
        description: "Returns show metadata with full season and episode list.",
        parameters: [{ $ref: "#/components/parameters/showboxId" }],
        responses: {
          "200": { description: "Show details", content: { "application/json": { schema: { $ref: "#/components/schemas/ShowDetails" } } } },
          "404": { description: "Show not found" },
        },
      },
    },
    "/api/media/stream/{id}": {
      get: {
        tags: ["Media"],
        summary: "▶ Proxied HLS Stream",
        description:
          "Fetches and proxies the `.m3u8` playlist through the server so the IP-locked FebBox token works in any browser or client.\n\n" +
          "Point `expo-video`, `react-native-video`, or `hls.js` at this URL.\n\n" +
          "```\nvideo.src = 'https://your-api/api/media/stream/168';\n```",
        parameters: [{ $ref: "#/components/parameters/showboxId" }],
        responses: {
          "200": { description: "HLS playlist (application/vnd.apple.mpegurl)", content: { "application/vnd.apple.mpegurl": { schema: { type: "string" } } } },
          "404": { description: "No stream found for this ID" },
          "502": { description: "Upstream FebBox error" },
        },
      },
    },
    "/api/media/play/{id}": {
      get: {
        tags: ["Media"],
        summary: "🎬 Browser Player",
        description: "Serves a full HTML page with an `hls.js` player pointed at the proxied stream. Open directly in a browser to test playback.",
        parameters: [{ $ref: "#/components/parameters/showboxId" }],
        responses: { "200": { description: "HTML player page", content: { "text/html": { schema: { type: "string" } } } } },
      },
    },
    "/api/media/segment": {
      get: {
        tags: ["Media"],
        summary: "HLS Segment Proxy",
        description: "Proxies individual `.ts` video segments. Used internally by `/api/media/stream/{id}` — you don't need to call this directly.",
        parameters: [{ name: "url", in: "query", required: true, schema: { type: "string", format: "uri" }, description: "Encoded upstream segment URL" }],
        responses: { "200": { description: "Video segment (video/MP2T)" } },
      },
    },
    "/api/febbox/folder/{id}": {
      get: {
        tags: ["FebBox"],
        summary: "Browse Folder",
        description: "Lists files and subdirectories in a FebBox shared folder.",
        parameters: [
          { name: "id", in: "path", schema: { type: "string", default: "0" }, description: "Folder ID (0 = root)" },
          { name: "share_key", in: "query", schema: { type: "string" }, description: "FebBox share key", example: "lFqKZvUV" },
        ],
        responses: { "200": { description: "Folder contents", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/FileItem" } } } } } },
      },
    },
    "/api/febbox/watch/{fid}": {
      get: {
        tags: ["FebBox"],
        summary: "Get Stream Links for File",
        description: "Returns all available quality stream links (HLS + MP4 ORG) for a specific FebBox file ID.",
        parameters: [{ name: "fid", in: "path", required: true, schema: { type: "string" }, description: "FebBox file ID", example: "2611614" }],
        responses: { "200": { description: "Stream sources", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/StreamSource" } } } } } },
      },
    },
  },
};
