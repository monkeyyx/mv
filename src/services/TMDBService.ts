import { config } from "../utils/config";
import type { Movie } from "../types";

const TMDB_BASE_URL = "https://api.themoviedb.org/3";

interface TMDBMovie {
  id: number;
  title: string;
  poster_path: string;
  release_date: string;
  vote_average: number;
}

interface TMDBShow {
  id: number;
  name: string;
  poster_path: string;
  first_air_date: string;
  vote_average: number;
}

export class TMDBService {
  private apiKey = config.TMDB_API_KEY;

  private async fetchFromTMDB(path: string): Promise<any> {
    const url = `${TMDB_BASE_URL}/${path}`;
    const options = {
      method: "GET",
      headers: {
        accept: "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
    };

    const response = await fetch(url, options);
    if (!response.ok) {
      throw new Error(`[TMDB] HTTP Error: ${response.status} for ${url}`);
    }
    return response.json();
  }

  private toMovie(item: TMDBMovie | TMDBShow): Movie {
    const isMovie = "title" in item;
    return {
      id: item.id.toString(),
      title: isMovie ? (item as TMDBMovie).title : (item as TMDBShow).name,
      poster: `https://image.tmdb.org/t/p/w500${item.poster_path}`,
      year: isMovie
        ? new Date((item as TMDBMovie).release_date).getFullYear().toString()
        : new Date((item as TMDBShow).first_air_date).getFullYear().toString(),
      rating: item.vote_average.toString(),
      box_type: isMovie ? 1 : 2,
    };
  }

  async getPopularMovies(page: number = 1): Promise<Movie[]> {
    const data = await this.fetchFromTMDB(
      `movie/popular?language=en-US&page=${page}`,
    );
    return (data.results || []).map(this.toMovie);
  }

  async getTopRatedMovies(page: number = 1): Promise<Movie[]> {
    const data = await this.fetchFromTMDB(
      `movie/top_rated?language=en-US&page=${page}`,
    );
    return (data.results || []).map(this.toMovie);
  }

  async getPopularShows(page: number = 1): Promise<Movie[]> {
    const data = await this.fetchFromTMDB(
      `tv/popular?language=en-US&page=${page}`,
    );
    return (data.results || []).map(this.toMovie);
  }

  async getTopRatedShows(page: number = 1): Promise<Movie[]> {
    const data = await this.fetchFromTMDB(
      `tv/top_rated?language=en-US&page=${page}`,
    );
    return (data.results || []).map(this.toMovie);
  }

  async getMovieGenres(): Promise<{ id: number; name: string }[]> {
    const data = await this.fetchFromTMDB(`genre/movie/list?language=en-US`);
    return data.genres || [];
  }

  async getShowGenres(): Promise<{ id: number; name: string }[]> {
    const data = await this.fetchFromTMDB(`genre/tv/list?language=en-US`);
    return data.genres || [];
  }

  async getMoviesByGenre(genreId: string, page: number = 1): Promise<Movie[]> {
    const data = await this.fetchFromTMDB(
      `discover/movie?language=en-US&with_genres=${genreId}&page=${page}`,
    );
    return (data.results || []).map(this.toMovie);
  }

  async getShowsByGenre(genreId: string, page: number = 1): Promise<Movie[]> {
    const data = await this.fetchFromTMDB(
      `discover/tv?language=en-US&with_genres=${genreId}&page=${page}`,
    );
    return (data.results || []).map(this.toMovie);
  }
}
