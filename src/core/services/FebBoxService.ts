import * as cheerio from "cheerio";
import type { FileItem, StreamSource } from "../types";

interface FebBoxResponse {
  code?: number;
  data?: {
    file_list?: any[];
    list?: any;
    html?: string;
  };
  html?: string;
}

export class FebBoxService {
  private baseUrl = "https://www.febbox.com";
  private headers = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9",
  };

  public uiCookie: string | undefined = "";

  private get cookie(): string {
    return this.uiCookie || "";
  }

  private async fetchRaw(
    url: string,
    extraHeaders: Record<string, string> = {},
  ): Promise<Response> {
    try {
      const headers: Record<string, string> = {
        ...this.headers,
        ...extraHeaders,
      };
      if (this.cookie) {
        headers["cookie"] = `ui=${this.cookie}`;
      }
      const response = await fetch(url, { headers });
      if (!response.ok) {
        throw new Error(`[FebBox] HTTP Error: ${response.status} for ${url}`);
      }
      return response;
    } catch (error) {
      throw new Error(`[FebBox] Fetch Error: ${(error as Error).message}`);
    }
  }

  // --- Public Share Logic ---

  async getFileList(
    shareKey: string,
    parentId: string = "0",
  ): Promise<FileItem[]> {
    try {
      const url = `${this.baseUrl}/file/file_share_list?share_key=${shareKey}&pwd=&parent_id=${parentId}&is_html=0`;
      const response = await this.fetchRaw(url, {
        referer: `${this.baseUrl}/share/${shareKey}`,
      });
      const data = await response.json() as FebBoxResponse;
      if (!data || !data.data) return [];

      return (data.data.file_list || []).map((f: any) => ({
        name: f.file_name,
        id: f.fid,
        is_dir: f.is_dir === 1,
        size: f.file_size_fmt,
        type: f.file_type,
      })) as FileItem[];
    } catch (error) {
      console.error(`[FebBox] Error in getFileList:`, error);
      return [];
    }
  }

  async getPublicLinks(shareKey: string, fid: string): Promise<StreamSource[]> {
    try {
      const url = `${this.baseUrl}/console/video_quality_list?fid=${fid}`;
      const response = await this.fetchRaw(url, {
        referer: `${this.baseUrl}/share/${shareKey}`,
      });
      const data = await response.json() as FebBoxResponse;
      return this.parseHtmlTable(data.html || "") as StreamSource[];
    } catch (error) {
      console.error(`[FebBox] Error in getPublicLinks:`, error);
      return [];
    }
  }

  // --- Private Console Logic ---

  async getConsoleFileList(
    parentId: string = "0",
    fromUid: string | null = null,
  ): Promise<FileItem[]> {
    try {
      let url = `${this.baseUrl}/console/${parentId === "0" ? "file_list" : "index_ajax"}`;
      const params = new URLSearchParams({ parent_id: parentId });

      if (fromUid && fromUid !== "0") {
        params.append("from_uid", fromUid);
        params.append("fid", parentId);
      }

      url += `${url.includes("?") ? "&" : "?"}${params.toString()}`;

      const response = await this.fetchRaw(url, {
        "x-requested-with": "XMLHttpRequest",
      });
      const data = await response.json() as FebBoxResponse;
      if (data.code !== 1) return [];

      const html =
        data.html || (data.data && (data.data.list || data.data.html)) || "";
      return this.parseHtmlTable(html, parentId) as FileItem[];
    } catch (error) {
      console.error(`[FebBox] Error in getConsoleFileList:`, error);
      return [];
    }
  }

  async searchConsole(query: string): Promise<FileItem[]> {
    try {
      const url = `${this.baseUrl}/console/index_ajax?q=${encodeURIComponent(query)}`;
      const response = await this.fetchRaw(url, {
        "x-requested-with": "XMLHttpRequest",
      });
      const data = await response.json() as FebBoxResponse;
      const html = data.data?.list || data.html || data.data?.html || "";
      return this.parseHtmlTable(html) as FileItem[];
    } catch (error) {
      console.error(`[FebBox] Error in searchConsole:`, error);
      return [];
    }
  }

  async getLinks(fid: string, shareKey?: string): Promise<StreamSource[]> {
    try {
      const url = `${this.baseUrl}/console/video_quality_list?fid=${fid}`;
      const headers: Record<string, string> = {
        "x-requested-with": "XMLHttpRequest",
      };
      if (shareKey) {
        headers["referer"] = `${this.baseUrl}/share/${shareKey}`;
      }
      const response = await this.fetchRaw(url, headers);
      const data = await response.json() as FebBoxResponse;
      return this.parseHtmlTable(data.html || "") as StreamSource[];
    } catch (error) {
      console.error(`[FebBox] Error in getLinks:`, error);
      return [];
    }
  }


  async getConsoleLinks(fid: string): Promise<StreamSource[]> {
    const url = `${this.baseUrl}/console/video_quality_list?fid=${fid}`;
    const response = await this.fetchRaw(url, {
      "x-requested-with": "XMLHttpRequest",
    });
    if (!response) return [];

    const data = await response.json() as FebBoxResponse;
    return this.parseHtmlTable(data.html || "") as StreamSource[];
  }

  // --- Shared Parser ---

  private parseHtmlTable(html: string, currentParentId: string = "0"): (FileItem | StreamSource)[] {
    if (!html) return [];

    const wrappedHtml =
      html.includes("<tr") && !html.includes("<table")
        ? `<table>${html}</table>`
        : html;
    const $ = cheerio.load(wrappedHtml);
    const results: (FileItem | StreamSource)[] = [];

    if ($("tr").length > 0) {
      $("tr").each((_, row) => {
        const $row = $(row);
        const link = $row.find("a").first().attr("href");

        let fid: string | null = null;
        let fromUid: string | null =
          $row.attr("data-uid") ||
          $row.find("[data-uid]").attr("data-uid") ||
          null;

        // 1. Try to get ID from data-id (Usually the most reliable for nested items)
        fid = $row.attr("fid") || $row.find("[data-id]").attr("data-id") || null;

        // 2. Intelligently parse the link if available
        if (link) {
          const urlObj = new URL(link, this.baseUrl);
          const fidParam = urlObj.searchParams.get("fid");
          const parentParam = urlObj.searchParams.get("parent_id");
          const uidParam = urlObj.searchParams.get("from_uid");

          if (uidParam) fromUid = uidParam;

          // If we're inside a share, 'parent_id' in the link is actually the child's ID
          if (parentParam && parentParam !== currentParentId) {
            fid = parentParam;
          } else if (fidParam && (!fid || fid === currentParentId)) {
            fid = fidParam;
          }
        }

        if (fid) {
          const name =
            $row
              .find(".file_name, .file-name, .file_info p")
              .first()
              .text()
              .trim() || $row.find("a").first().text().trim();
          const isDir =
            $row.find(".icon-folder, .icon_folder, [data-is-dir='1']").length >
              0 ||
            (link && link.includes("files?"));

          if (name && fid)
            results.push({ name, id: fid, is_dir: isDir, from_uid: fromUid } as FileItem);
        } else {
          // Quality Table Fallback
          const quality = $row.find("td").first().text().trim();
          const url = $row.find("a.btn-download").attr("href");
          if (quality && url) {
            results.push({
              url,
              quality,
              label: quality === "ORG" ? "Original" : `${quality}p`,
            } as StreamSource);
          }
        }
      });
    }

    // Quality Divs
    $(".file_quality").each((_, div) => {
      const $div = $(div);
      const url = $div.attr("data-url");
      const quality = $div.attr("data-quality");
      const size = $div.find(".size").text().trim();
      if (url && quality) {
        results.push({
          url,
          quality,
          size,
          label: quality === "ORG" ? "Original Quality" : quality,
        } as StreamSource);
      }
    });

    return results;
  }
}
