import { ShowboxService } from "../src/services/ShowboxService.js";

async function test() {
  const api = new ShowboxService();
  console.log("Fetching Discover Categories (Raw Request)...");
  try {
    const rawData = await (api as any).request("Discover_V2");
    console.log(JSON.stringify(rawData, null, 2));
  } catch (error) {
    console.error("Discover API failed:", error);
  }
}

test();
