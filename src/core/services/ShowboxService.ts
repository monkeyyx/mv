import { Buffer } from "node:buffer";
import { ShowboxCrypto, nanoid } from "../utils/crypto";
import type { Movie, ShowDetails, ShowboxSearchItem, ShowboxDetail, ShowboxEpisode } from "../types";

const CONFIG = {
  BASE_URL: "https://mbpapi.shegu.net/api/api_client/index/",
  APP_ID: "com.tdo.showbox",
  DEFAULTS: {
    CHILD_MODE: "0",
    APP_VERSION: "11.5",
    LANG: "en",
    PLATFORM: "android",
    CHANNEL: "Website",
    APPID: "27",
    VERSION: "129",
    MEDIUM: "Website",
  },
};

interface ShowboxResponse<T> {
  code: number;
  msg: string;
  data: T;
}

export class ShowboxService {
  private async request<T>(
    module: string,
    params: Record<string, string | number> = {},
  ): Promise<ShowboxResponse<T>> {
    try {
      const requestData = {
        ...CONFIG.DEFAULTS,
        expired_date: Math.floor(Date.now() / 1000 + 12 * 60 * 60),
        module,
        ...params,
      };

      const encryptedData = ShowboxCrypto.encrypt(JSON.stringify(requestData));
      const body = JSON.stringify({
        app_key: ShowboxCrypto.getAppKeyMd5(),
        verify: ShowboxCrypto.generateVerify(encryptedData),
        encrypt_data: encryptedData,
      });

      const formData = new URLSearchParams({
        data: Buffer.from(body).toString("base64"),
        appid: CONFIG.DEFAULTS.APPID,
        platform: CONFIG.DEFAULTS.PLATFORM,
        version: CONFIG.DEFAULTS.VERSION,
        medium: CONFIG.DEFAULTS.MEDIUM,
      });

      console.log(`[Showbox] Requesting ${module}...`);
      const response = await fetch(CONFIG.BASE_URL, {
        method: "POST",
        headers: {
          Platform: CONFIG.DEFAULTS.PLATFORM,
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "okhttp/3.2.0",
        },
        body: `${formData.toString()}&token${nanoid()}`,
      });

      console.log(`[Showbox] Response Status: ${response.status}`);
      if (!response.ok) return { code: -1, msg: "HTTP Error", data: null as unknown as T };
      const result = (await response.json()) as ShowboxResponse<T>;
      console.log(`[Showbox] Result Code: ${result?.code}`);
      return result;
    } catch (error) {
      console.error(`[Showbox] Request Error:`, error);
      return { code: -1, msg: "Request Failed", data: null as unknown as T };
    }
  }

  async autocomplete(keyword: string): Promise<string[]> {
    const data = await this.request<string[]>("Autocomplate2", {
      keyword,
      pagelimit: "10",
    });
    return data?.data || [];
  }

  async search(
    keyword: string,
    type: string = "all",
    year?: string,
  ): Promise<Movie[]> {
    const data = await this.request<ShowboxSearchItem[]>("Search5", {
      keyword,
      type,
      page: 1,
      pagelimit: 20,
    });

    const results = (data?.data || []).map((item: ShowboxSearchItem) => ({
      id: item.id.toString(),
      title: item.title,
      poster: item.poster,
      year: item.year?.toString(),
      rating: item.imdb_rating,
      box_type: item.box_type,
    }));

    if (year && results.length > 0) {
      const yearMatch = results.find((r) => r.year === year);
      if (yearMatch) {
        return [
          yearMatch,
          ...results.filter((r) => r.id !== yearMatch.id),
        ];
      }
    }

    return results;
  }

  async getMovieDetails(id: string): Promise<Movie | null> {
    const data = await this.request<ShowboxSearchItem>("Movie_detail", { mid: id });
    const item = data?.data;
    if (!item) return null;
    
    return {
        id: item.id.toString(),
        title: item.title,
        poster: item.poster,
        year: item.year?.toString(),
        rating: item.imdb_rating,
        box_type: item.box_type,
    };
  }

  async getShowDetails(id: string): Promise<ShowDetails | null> {
    const data = await this.request<ShowboxDetail>("TV_detail_v2", { tid: id });
    const info = data?.data;
    if (!info) return null;

    return {
      id: info.id.toString(),
      title: info.title,
      poster: info.poster,
      year: info.year?.toString(),
      rating: info.imdb_rating,
      box_type: 2,
      seasons: (info.season || []).map((seasonNum: number) => ({
        season: seasonNum,
        episodes: (info.episode || [])
          .filter((e: ShowboxEpisode) => e.season === seasonNum)
          .map((e: ShowboxEpisode) => ({
            episode: e.episode,
            title: e.title,
            id: e.id.toString(),
          })),
      })),
    };
  }

  async getFebBoxId(id: string, type: string): Promise<string | null> {
    try {
      const response = await fetch(
        `https://www.showbox.media/index/share_link?id=${id}&type=${type}`,
      );
      const data = (await response.json()) as { data?: { link?: string } };
      return data?.data?.link?.split("/").pop() || null;
    } catch (e) {
      console.error(`[Showbox] getFebBoxId failed for ${id}:`, e);
      return null;
    }
  }

  async getDiscover(): Promise<Movie[]> {
    const data = await this.request<ShowboxSearchItem[]>("Discover_V2");
    const rawList = data?.data || [];
    return rawList.map((item: ShowboxSearchItem) => ({
      id: item.id.toString(),
      title: item.title,
      poster: item.poster,
      year: item.year?.toString(),
      rating: item.imdb_rating,
      box_type: item.box_type,
    }));
  }

  async getMovieList(
    listType: "movie" | "tv",
    filter: "featured" | "top",
    page: number = 1,
    pageSize: number = 20,
  ): Promise<Movie[]> {
    const data = await this.request<{ list?: ShowboxSearchItem[] } | ShowboxSearchItem[]>("movie_list", {
      childmode: "0",
      list_type: listType,
      type: "all",
      filter,
      page,
      pagelimit: pageSize,
    });

    const rawData = data?.data;
    let list: ShowboxSearchItem[] = [];
    if (Array.isArray(rawData)) {
      list = rawData;
    } else if (rawData && typeof rawData === 'object' && 'list' in rawData && Array.isArray(rawData.list)) {
      list = rawData.list;
    }

    return (list as ShowboxSearchItem[]).map((item: ShowboxSearchItem) => ({
      id: item.id.toString(),
      title: item.title,
      poster: item.poster,
      year: item.year?.toString(),
      rating: item.imdb_rating,
      box_type: item.box_type,
    }));
  }
}
