import { ShowboxService } from "../src/services/ShowboxService.js";

async function test() {
  const api = new ShowboxService();
  console.log("Fetching Discover Categories...");
  try {
    const discoverCategories = await api.getDiscover();
    console.log(JSON.stringify(discoverCategories, null, 2));
  } catch (error) {
    console.error("Discover API failed:", error);
  }
}

test();
