import express from "express";
import cors from "cors";
import { apiReference } from "@scalar/express-api-reference";
import { config } from "./utils/config";
import openApiSpec from "./api-spec.json";

// Import Modular Routes
import systemRoutes from "./routes/system";
import mediaRoutes from "./routes/media";
import febboxRoutes from "./routes/febbox";
import discoverRoutes from "./routes/discover";

import path from "path";

// --- Initialization ---
const app = express();
const port = parseInt(config.API_PORT);

// --- Global Middleware ---
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// --- Scalar Documentation (Premium Theme) ---
app.use(
  "/docs",
  apiReference({
    theme: "deepSpace",
    spec: { content: openApiSpec },
    defaultOpenAllTags: true,
    showSidebar: true,
  } as any),
);

// Dashboard Route
app.get("/test", (req, res) => {
  res.sendFile(path.join(__dirname, "public/index.html"));
});

// Redirect root to docs
app.get("/", (req, res) => {
  res.redirect("/docs");
});

// --- Mount Modular Routes ---
app.use("/api/system", systemRoutes);
app.use("/api/media", mediaRoutes);
app.use("/api/febbox", febboxRoutes);
app.use("/api/discover", discoverRoutes);

// --- Start Server ---
if (process.env.NODE_ENV !== "test") {
  app.listen(port, () => {
    console.log(
      `🚀 MyFlixi v2.1 (Modular Bun/TS) live at http://localhost:${port}`,
    );
    console.log(`📜 Documentation available at http://localhost:${port}/docs`);
  });
}

export { app };
