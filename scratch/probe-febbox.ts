const cookie = process.env.FEBBOX_UI_COOKIE || "";

async function probe() {
  console.log("--- Probing FebBox Search ---");
  const url = `https://www.febbox.com/console/index_ajax?q=2T7UU`;
  
  const res = await fetch(url, {
    headers: {
      "cookie": `ui=${cookie}`,
      "x-requested-with": "XMLHttpRequest",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    }
  });

  const data = await res.json();
  console.log("Response Code:", data.code);
  console.log("Response Keys:", Object.keys(data));
  
  const html = data.data?.list || data.html || data.data?.html || "";
  console.log("HTML Sample (First 500 chars):", html.substring(0, 500));
}

probe();
