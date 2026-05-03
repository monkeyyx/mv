const baseUrl = "https://showbox.shegu.net/api/api_client/index1/index";
const appId = "com.tdo.showbox";

async function debug() {
  console.log("--- Testing Showbox Search ---");
  const searchParams = new URLSearchParams({
    app_id: appId,
    module: "Search",
    keyword: "Avatar",
    type: "all",
    page: "1",
    pagelimit: "5"
  });
  
  const res = await fetch(`${baseUrl}?${searchParams.toString()}`);
  const data = await res.json();
  console.log("Search Response Keys:", Object.keys(data));
  if (data.data) {
    console.log("First Result:", data.data[0]);
  } else {
    console.log("No data field found. Full response:", JSON.stringify(data, null, 2));
  }
}

debug();
