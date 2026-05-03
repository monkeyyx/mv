export interface ShowboxSearchItem {
  id: number;
  box_type: number;
  title: string;
  poster: string;
  year: number;
  imdb_rating: string;
  description: string;
  actors: string;
  cats: string;
  poster_min: string;
  poster_org: string;
}

export interface ShowboxEpisode {
  id: number;
  episode: number;
  season: number;
  title: string;
}

export interface ShowboxDetail {
  id: number;
  title: string;
  poster: string;
  year: number;
  imdb_rating: string;
  season: number[];
  episode: ShowboxEpisode[];
}

export interface Movie {
  id: string;
  title: string;
  poster: string;
  year?: string;
  rating?: string;
  box_type: string | number;
  isAvailable?: boolean;
  showbox_id?: string | number;
}

export interface FileItem {
  name: string;
  id: string;
  parent_id?: string | null;
  from_uid?: string | null;
  is_dir: boolean;
  poster?: string | null;
  size?: string;
  type?: string;
  date?: string;
}

export interface StreamSource {
  url: string;
  stream_url?: string;
  quality: string;
  label: string;
  size?: string;
}

export interface ShowDetails extends Movie {
  shareKey?: string;
  febBoxId?: string;
  seasons: {
    season: number;
    episodes: {
      episode: number;
      title: string;
      id: string;
      fid?: string;
    }[];
  }[];
}
