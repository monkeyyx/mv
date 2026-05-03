import { FebBoxService } from "../services/FebBoxService";
import dotenv from "dotenv";

dotenv.config();

const febBoxService = new FebBoxService();

describe("FebBox API", () => {
  it("should get public file list", async () => {
    const shareKey = process.env.FEBBOX_SHARE_KEY || "";
    if (!shareKey) {
      console.warn("Skipping getPublicFileList test: FEBBOX_SHARE_KEY not set");
      return;
    }
    const files = await febBoxService.getFileList(shareKey);
    expect(files).toBeInstanceOf(Array);
    expect(files.length).toBeGreaterThan(0);
  });

  it("should get public links", async () => {
    const shareKey = process.env.FEBBOX_SHARE_KEY || "";
    const fid = process.env.FEBBOX_FID || "";
    if (!shareKey || !fid) {
      console.warn(
        "Skipping getPublicLinks test: FEBBOX_SHARE_KEY or FEBBOX_FID not set",
      );
      return;
    }
    const links = await febBoxService.getPublicLinks(shareKey, fid);
    expect(links).toBeInstanceOf(Array);
    expect(links.length).toBeGreaterThan(0);
  });

  it("should get console file list", async () => {
    if (!process.env.FEBBOX_UI_COOKIE) {
      console.warn(
        "Skipping getConsoleFileList test: FEBBOX_UI_COOKIE not set",
      );
      return;
    }
    const files = await febBoxService.getConsoleFileList();
    expect(files).toBeInstanceOf(Array);
  });

  it("should search console", async () => {
    if (!process.env.FEBBOX_UI_COOKIE) {
      console.warn("Skipping searchConsole test: FEBBOX_UI_COOKIE not set");
      return;
    }
    const query = "test"; // Replace with a valid search query
    const files = await febBoxService.searchConsole(query);
    expect(files).toBeInstanceOf(Array);
    expect(files.length).toBeGreaterThan(0);
  });

  it("should get console links", async () => {
    if (!process.env.FEBBOX_UI_COOKIE) {
      console.warn("Skipping getConsoleLinks test: FEBBOX_UI_COOKIE not set");
      return;
    }
    const fid = process.env.FEBBOX_FID || "";
    if (!fid) {
      console.warn("Skipping getConsoleLinks test: FEBBOX_FID not set");
      return;
    }
    const links = await febBoxService.getConsoleLinks(fid);
    expect(links).toBeInstanceOf(Array);
    expect(links.length).toBeGreaterThan(0);
  });
});
