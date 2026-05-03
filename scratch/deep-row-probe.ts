const cookie = process.env.FEBBOX_UI_COOKIE || "";

async function deepProbe() {
  const url = `https://www.febbox.com/console/index_ajax?q=2T7UU`;
  const res = await fetch(url, {
    headers: {
      "cookie": `ui=${cookie}`,
      "x-requested-with": "XMLHttpRequest",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    }
  });

  const data = await res.json();
  const html = data.data?.list || data.html || data.data?.html || "";
  
  // Find the first row and print it entirely
  const match = html.match(/<tr[^>]*>([\s\S]*?)<\/tr>/);
  if (match) {
    console.log("--- FULL ROW HTML ---");
    console.log(match[0]);
  } else {
    console.log("No TR found in HTML:", html);
  }
}

deepProbe();
