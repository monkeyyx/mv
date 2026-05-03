import { Router } from "express";
import { config } from "../utils/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const router = Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

router.get("/status", (req, res) => {
  const uptime = process.uptime();
  const minutes = Math.floor(uptime / 60);
  const seconds = Math.floor(uptime % 60);

  const statusResponse: any = {
    status: "online",
    version: "2.1.0 (Modular)",
    uptime: minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`,
    systems: {
      admin: "healthy",
      discovery: "healthy",
      console: "healthy",
    },
  };

  if (config.NODE_ENV === "development") {
    statusResponse.DEBUG_MODE = true;
    statusResponse.FEBBOX_COOKIE_STATUS = process.env.FEBBOX_UI_COOKIE
      ? "present"
      : "missing";
  }
  res.json(statusResponse);
});

router.get("/set-cookie", (req, res) => {
  const { secret, cookie } = req.query;
  if (secret !== config.ADMIN_SECRET)
    return res.status(403).json({ error: "Unauthorized" });
  if (!cookie) return res.status(400).json({ error: "Missing cookie" });

  process.env.FEBBOX_UI_COOKIE = cookie as string;
  const envPath = path.join(__dirname, "../../.env");
  if (fs.existsSync(envPath)) {
    let content = fs.readFileSync(envPath, "utf8");
    const regex = /^FEBBOX_UI_COOKIE=.*$/m;
    content = regex.test(content)
      ? content.replace(regex, `FEBBOX_UI_COOKIE='${cookie}'`)
      : content + `\nFEBBOX_UI_COOKIE='${cookie}'`;
    fs.writeFileSync(envPath, content);
  }
  res.json({ success: true, message: "Cookie updated and persisted" });
});

export default router;
