import { expect, it, describe } from "bun:test";
import { FebBoxService } from "../core/services/FebBoxService";
import dotenv from "dotenv";

dotenv.config();

const febBoxService = new FebBoxService();
// Manually set cookie for service testing if needed
febBoxService.uiCookie = process.env.FEBBOX_UI_COOKIE || "";

describe("FebBoxService Unit Tests", () => {
  it("should get public file list if share key is valid", async () => {
    const shareKey = "m6k8v9"; // Example public share or use process.env
    const files = await febBoxService.getFileList(shareKey);
    expect(Array.isArray(files)).toBe(true);
  }, 30000);

  it("should handle console file list (requires UI_COOKIE)", async () => {
    if (!febBoxService.uiCookie) {
        console.warn("Skipping console test: FEBBOX_UI_COOKIE not set");
        return;
    }
    const files = await febBoxService.getConsoleFileList();
    expect(Array.isArray(files)).toBe(true);
  }, 30000);
});
