const cookie = process.env.FEBBOX_UI_COOKIE || "";
async function probe() {
  const url = `https://www.febbox.com/console/index_ajax?fid=46901362&from_uid=1352815&parent_id=46901362`;
  const res = await fetch(url, {
    headers: {
      cookie: `ui=${cookie}`,
      "x-requested-with": "XMLHttpRequest",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
    },
  });

  const json = await res.json();
  const html = json.data?.list || json.html || "";
  console.log("--- HTML SNIPPET ---");
  console.log(html.substring(0, 1000));
}

probe();
