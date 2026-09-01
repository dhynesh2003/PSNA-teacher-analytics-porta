import express from "express";
import cors from "cors";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { pinoHttp } from "pino-http";
import { config } from "./config.js";
import { requireCollegeAccess } from "./middleware/auth.js";
import { dashboardRouter } from "./routes/dashboard.js";
import { liveRouter } from "./routes/live.js";
import { syncRouter } from "./routes/sync.js";

const app = express();
app.disable("x-powered-by");
app.use(helmet());
app.use(cors({ origin: config.APP_ORIGIN.split(",").map(x => x.trim()), credentials: false }));
app.use(express.json({ limit: "1mb" }));
app.use(pinoHttp({ redact: ["req.headers.authorization", "req.body.email", "req.body.mobile"] }));
app.use(rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: "draft-8", legacyHeaders: false }));
app.get("/health", (_req, res) => res.json({ status: "ok" }));
app.use("/api/my-college", requireCollegeAccess, dashboardRouter);
app.use("/api/my-college/live", requireCollegeAccess, liveRouter);
app.use("/api/my-college/sync", requireCollegeAccess, syncRouter);
app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(error);
  res.status(500).json({ error: "INTERNAL_ERROR" });
});
app.listen(config.PORT, () => console.log(`Edmingle backend listening on ${config.PORT}`));
