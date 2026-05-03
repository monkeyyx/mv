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
  box_type: string | number;
  isAvailable?: boolean;
  showbox_id?: string | number;
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
