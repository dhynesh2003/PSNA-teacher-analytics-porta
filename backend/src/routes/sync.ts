import { Router } from "express";
import { z } from "zod";
import { adminDb } from "../supabase.js";
import { syncPsnaAnalytics, type SyncMode } from "../sync/psna.js";

export const syncRouter = Router();
let activeSync: Promise<unknown> | null = null;

syncRouter.get("/status", async (req, res, next) => {
  try {
    const { data, error } = await adminDb.from("edmingle_live_sync_runs")
      .select("id,sync_mode,status,batches_synced,students_synced,content_rows_synced,test_rows_synced,submissions_synced,error_summary,started_at,completed_at")
      .eq("college_id", req.access!.collegeId).order("started_at", { ascending: false }).limit(10);
    if (error) throw error;
    res.json({ running: Boolean(activeSync), data });
  } catch (error) { next(error); }
});

syncRouter.post("/", async (req, res, next) => {
  try {
    if (!["hod", "super_admin", "college_admin"].includes(req.access!.role)) {
      return res.status(403).json({ error: "SYNC_REQUIRES_HOD_OR_ADMIN" });
    }
    if (activeSync) return res.status(409).json({ error: "SYNC_ALREADY_RUNNING" });
    const mode = z.enum(["roster", "full"]).default("full").parse(req.body?.mode) as SyncMode;
    activeSync = syncPsnaAnalytics(mode, progress => console.log(JSON.stringify({ event: "psna_sync", ...progress })))
      .catch(error => console.error("PSNA sync failed", error))
      .finally(() => { activeSync = null; });
    res.status(202).json({ accepted: true, mode, message: mode === "full" ? "Full sync started. It is intentionally rate-limited." : "Roster sync started." });
  } catch (error) { next(error); }
});
