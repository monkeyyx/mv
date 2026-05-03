import * as cheerio from "cheerio";

const rawHtml = `<tr read_only="1" >
    <td data-id="48734205" data-is-dir="1" data-file-size="466804729004130" data-uid="1696859" data-custom="0" data-imdb-id="" data-epub="0" class="share_dir my_sub">
        </td>
    <td draggable="true" >
    <div class="file_icon" >
        <img src="/static/index_img/file_type/share_dir_icon.png">
            <img src="/static/index_img/file_btn/read_only.png" width="14" class="receive_icon">
            </div>
        <a href="/console#/files?fid=46901362&from_uid=1352815&parent_id=46901362">
            <div class="file_info">
        <p class="file_name">TVshow</p>
        <p class="file_name_show">TVshow</p>
            </div>
        </a>
    </td>
</tr>`;

function testParse(html) {
    // Force a table wrapper if it looks like a row fragment
    const wrappedHtml = html.includes("<tr") && !html.includes("<table") ? `<table>${html}</table>` : html;
    const $ = cheerio.load(wrappedHtml);
    const results = [];

    console.log("Total TRs found:", $("tr").length);

    $("tr").each((i, row) => {
        const $row = $(row);
        const dataId = $row.find("[data-id]").attr("data-id");
        const link = $row.find("a[href*='fid=']").attr("href");
        let fid = dataId;
        if (link) {
            const match = link.match(/fid=([0-9]+)/);
            if (match) fid = match[1];
        }

        if (fid) {
            const name = $row.find(".file_name, .file-name, .file_info p").first().text().trim();
            results.push({ name, id: fid });
        }
    });

    return results;
}

console.log("--- Final Test Results ---");
console.log(JSON.stringify(testParse(rawHtml), null, 2));
