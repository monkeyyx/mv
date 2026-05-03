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

export interface WatchResponse {
  fid: string;
  stream_type: "direct";
  sources: StreamSource[];
  default_source: StreamSource | null;
}

export interface Movie {
  id: string;
  title: string;
  poster: string;
  year?: string;
  rating?: string;
  box_type: string;
}

export interface ShowDetails extends Movie {
  seasons: {
    season_number: number;
    episodes: {
      episode_number: number;
      title: string;
      id: string;
    }[];
  }[];
}

export interface SystemStatus {
  status: "online" | "offline";
  verified_endpoints: number;
  version: string;
  uptime: string;
  systems: {
    admin: string;
    discovery: string;
    console: string;
    shared: string;
  };
  auth: {
    febbox_cookie: "present" | "missing";
  };
}
