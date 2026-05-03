import { ShowboxCrypto, nanoid } from "../utils/crypto";
import type { Movie, ShowDetails } from "../types";

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

export class ShowboxService {
  private async request(
    module: string,
    params: Record<string, any> = {},
  ): Promise<any> {
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

      const response = await fetch(CONFIG.BASE_URL, {
        method: "POST",
        headers: {
          Platform: CONFIG.DEFAULTS.PLATFORM,
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "okhttp/3.2.0",
        },
        body: `${formData.toString()}&token${nanoid()}`,
      });

      if (!response.ok) return { data: null };
      return await response.json();
    } catch (error) {
      console.error(`[Showbox] Request Error:`, error);
      return { data: null };
    }
  }

  async autocomplete(keyword: string): Promise<string[]> {
    const data = await this.request("Autocomplate2", {
      keyword,
      pagelimit: "10",
    });
    return data?.data || [];
  }

  async search(keyword: string, type: string = "all"): Promise<Movie[]> {
    const data = await this.request("Search5", {
      keyword,
      type,
      page: 1,
      pagelimit: 20,
    });

    return (data?.data || []).map((item: any) => ({
      id: item.id,
      title: item.title,
      poster: item.poster,
      year: item.year,
      rating: item.imdb_rating,
      box_type: item.box_type,
    }));
  }

  async getMovieDetails(id: string): Promise<any> {
    const data = await this.request("Movie_detail", { mid: id });
    return data?.data || null;
  }

  async getShowDetails(id: string): Promise<ShowDetails | null> {
    const data = await this.request("TV_detail_v2", { tid: id });
    const info = data?.data;
    if (!info) return null;

    return {
      id: info.id,
      title: info.title,
      poster: info.poster,
      year: info.year,
      rating: info.imdb_rating,
      seasons: (info.season || []).map((seasonNum: number) => ({
        season: seasonNum,
        episodes: (info.episode || [])
          .filter((e: any) => e.season === seasonNum)
          .map((e: any) => ({
            episode: e.episode,
            title: e.title,
            id: e.id,
          })),
      })),
    };
  }

  async getFebBoxId(id: string, type: string): Promise<string | null> {
    try {
      const response = await fetch(
        `https://www.showbox.media/index/share_link?id=${id}&type=${type}`,
      );
      const data = await response.json();
      return data?.data?.link?.split("/").pop() || null;
    } catch (e) {
      return null;
    }
  }

  async getDiscover(): Promise<any> {
    const data = await this.request("Discover_V2");
    return data?.data || [];
  }

  async getMovieList(
    listType: "movie" | "tv",
    filter: "featured" | "top",
    page: number = 1,
    pageSize: number = 20,
  ): Promise<Movie[]> {
    const data = await this.request("movie_list", {
      childmode: "0",
      list_type: listType,
      type: "all",
      filter,
      page,
      pagelimit: pageSize,
    });

    const list = data?.data?.list || data?.data || [];

    return list.map((item: any) => ({
      id: item.id,
      title: item.title,
      poster: item.poster,
      year: item.year,
      rating: item.imdb_rating,
      box_type: item.box_type,
    }));
  }
}
