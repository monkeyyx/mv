import { ShowboxService } from "../src/services/ShowboxService.js";

async function test() {
  const api = new ShowboxService();
  const rawData = await (api as any).request("TV_detail_v2", { tid: "125" });
  
  if (rawData?.data) {
    console.log("Keys in TV_detail_v2:", Object.keys(rawData.data));
    console.log("season type:", typeof rawData.data.season, rawData.data.season);
    
    // if there's an episode or episodes array, check its length and structure
    for (const key of Object.keys(rawData.data)) {
        if (key.includes("episode") || key.includes("ep")) {
             console.log(`Property ${key}:`, JSON.stringify(rawData.data[key]).slice(0, 200));
        }
    }
  }
}

test();
