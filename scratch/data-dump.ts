const cookie = process.env.FEBBOX_UI_COOKIE || "";

async function dump() {
  const url = `https://www.febbox.com/console/index_ajax?q=2T7UU`;
  const res = await fetch(url, {
    headers: {
      "cookie": `ui=${cookie}`,
      "x-requested-with": "XMLHttpRequest",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    }
  });

  const json = await res.json();
  console.log("--- RAW DATA DUMP ---");
  console.log(JSON.stringify(json, null, 2));
}

dump();
