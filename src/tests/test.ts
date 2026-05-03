import { ShowboxService } from "../services/ShowboxService";
import { FebBoxService } from "../services/FebBoxService";

const showbox = new ShowboxService();
const febbox = new FebBoxService();

async function runDiagnostic() {
  console.log("🚀 Starting API Diagnostic...");

  // 1. Test Search
  const searchResults = await showbox.search("ratatouille");
  console.log(
    `🎬 Search found ${searchResults.length} items. First result: ${searchResults[0]?.title}`,
  );

  // 2. Test Console Search
  try {
    const consoleResults = await febbox.searchConsole("2T7UU");
    console.log(`📂 Console Search found ${consoleResults.length} files.`);
  } catch (e: any) {
    console.warn("⚠️ Console access failed (is your cookie set?):", e.message);
  }

  console.log("✅ Diagnostic complete!");
}

runDiagnostic();
