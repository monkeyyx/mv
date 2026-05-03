import type { Movie } from "../types";

const TMDB_BASE_URL = "https://api.themoviedb.org/3";

interface TMDBMovie {
  id: number;
  title: string;
  poster_path: string;
  release_date: string;
  vote_average: number;
  genre_ids?: number[];
  original_language?: string;
}

interface TMDBShow {
  id: number;
  name: string;
  poster_path: string;
  first_air_date: string;
  vote_average: number;
  genre_ids?: number[];
  original_language?: string;
}

interface TMDBGenre {
  id: number;
  name: string;
}

export class TMDBService {
  public apiKey: string = "";

  private async fetchFromTMDB<T = unknown>(path: string): Promise<T> {
    const url = `${TMDB_BASE_URL}/${path}`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        accept: "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
    });
    if (!response.ok) {
      throw new Error(`[TMDB] HTTP Error: ${response.status} for ${url}`);
    }
    return response.json() as Promise<T>;
  }

  private toMovie(item: TMDBMovie | TMDBShow): Movie {
    const isMovie = "title" in item;
    return {
      id: item.id.toString(),
      title: isMovie ? (item as TMDBMovie).title : (item as TMDBShow).name,
      poster: item.poster_path
        ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
        : "",
      year: isMovie
        ? new Date((item as TMDBMovie).release_date).getFullYear().toString()
        : new Date((item as TMDBShow).first_air_date).getFullYear().toString(),
      rating: item.vote_average.toFixed(1),
      box_type: isMovie ? 1 : 2,
    };
  }

  // --- Movies ---

  async getPopularMovies(page = 1): Promise<Movie[]> {
    const data = await this.fetchFromTMDB<{ results: TMDBMovie[] }>(
      `movie/popular?language=en-US&page=${page}`
    );
    return (data.results || []).map((m) => this.toMovie(m));
  }

  async getTopRatedMovies(page = 1): Promise<Movie[]> {
    const data = await this.fetchFromTMDB<{ results: TMDBMovie[] }>(
      `movie/top_rated?language=en-US&page=${page}`
    );
    return (data.results || []).map((m) => this.toMovie(m));
  }

  async getNowPlayingMovies(page = 1): Promise<Movie[]> {
    const data = await this.fetchFromTMDB<{ results: TMDBMovie[] }>(
      `movie/now_playing?language=en-US&page=${page}`
    );
    return (data.results || []).map((m) => this.toMovie(m));
  }

  async getUpcomingMovies(page = 1): Promise<Movie[]> {
    const data = await this.fetchFromTMDB<{ results: TMDBMovie[] }>(
      `movie/upcoming?language=en-US&page=${page}`
    );
    return (data.results || []).map((m) => this.toMovie(m));
  }

  // --- TV Shows ---

  async getPopularShows(page = 1): Promise<Movie[]> {
    const data = await this.fetchFromTMDB<{ results: TMDBShow[] }>(
      `tv/popular?language=en-US&page=${page}`
    );
    return (data.results || []).map((m) => this.toMovie(m));
  }

  async getTopRatedShows(page = 1): Promise<Movie[]> {
    const data = await this.fetchFromTMDB<{ results: TMDBShow[] }>(
      `tv/top_rated?language=en-US&page=${page}`
    );
    return (data.results || []).map((m) => this.toMovie(m));
  }

  async getAiringTodayShows(page = 1): Promise<Movie[]> {
    const data = await this.fetchFromTMDB<{ results: TMDBShow[] }>(
      `tv/airing_today?language=en-US&page=${page}`
    );
    return (data.results || []).map((m) => this.toMovie(m));
  }

  // --- Genres ---

  async getMovieGenres(): Promise<TMDBGenre[]> {
    const data = await this.fetchFromTMDB<{ genres: TMDBGenre[] }>(
      `genre/movie/list?language=en-US`
    );
    return data.genres || [];
  }

  async getShowGenres(): Promise<TMDBGenre[]> {
    const data = await this.fetchFromTMDB<{ genres: TMDBGenre[] }>(
      `genre/tv/list?language=en-US`
    );
    return data.genres || [];
  }

  // --- Discover with filters ---

  async discoverMovies(opts: {
    page?: number;
    genreId?: string;
    language?: string;    // original_language e.g. 'ja', 'ko'
    sortBy?: string;      // popularity.desc, vote_average.desc, etc.
    minRating?: number;
  } = {}): Promise<Movie[]> {
    const params = new URLSearchParams({
      language: "en-US",
      page: String(opts.page ?? 1),
      sort_by: opts.sortBy ?? "popularity.desc",
      "vote_count.gte": "100",
    });
    if (opts.genreId) params.set("with_genres", opts.genreId);
    if (opts.language) params.set("with_original_language", opts.language);
    if (opts.minRating) params.set("vote_average.gte", String(opts.minRating));

    const data = await this.fetchFromTMDB<{ results: TMDBMovie[] }>(
      `discover/movie?${params}`
    );
    return (data.results || []).map((m) => this.toMovie(m));
  }

  async discoverShows(opts: {
    page?: number;
    genreId?: string;
    language?: string;
    sortBy?: string;
    minRating?: number;
  } = {}): Promise<Movie[]> {
    const params = new URLSearchParams({
      language: "en-US",
      page: String(opts.page ?? 1),
      sort_by: opts.sortBy ?? "popularity.desc",
      "vote_count.gte": "50",
    });
    if (opts.genreId) params.set("with_genres", opts.genreId);
    if (opts.language) params.set("with_original_language", opts.language);
    if (opts.minRating) params.set("vote_average.gte", String(opts.minRating));

    const data = await this.fetchFromTMDB<{ results: TMDBShow[] }>(
      `discover/tv?${params}`
    );
    return (data.results || []).map((m) => this.toMovie(m));
  }

  // --- Convenience wrappers for common categories ---

  /** Animation movies (genre 16) */
  async getAnimationMovies(page = 1): Promise<Movie[]> {
    return this.discoverMovies({ page, genreId: "16" });
  }

  /** Anime: Japanese animated TV (genre 16 + language ja) */
  async getAnime(page = 1): Promise<Movie[]> {
    return this.discoverShows({ page, genreId: "16", language: "ja" });
  }

  /** Korean dramas */
  async getKoreanDramas(page = 1): Promise<Movie[]> {
    return this.discoverShows({ page, language: "ko" });
  }

  /** Action movies */
  async getActionMovies(page = 1): Promise<Movie[]> {
    return this.discoverMovies({ page, genreId: "28" });
  }

  /** Comedy movies */
  async getComedyMovies(page = 1): Promise<Movie[]> {
    return this.discoverMovies({ page, genreId: "35" });
  }

  /** Horror movies */
  async getHorrorMovies(page = 1): Promise<Movie[]> {
    return this.discoverMovies({ page, genreId: "27" });
  }

  /** Sci-Fi movies */
  async getSciFiMovies(page = 1): Promise<Movie[]> {
    return this.discoverMovies({ page, genreId: "878" });
  }
}
