import { Router } from "express";
import { z } from "zod";
import { config } from "../config.js";
import { getBatchStudents, getExerciseProgress, getMaterialProgress, listBatches } from "../edmingle/client.js";
import { adminDb } from "../supabase.js";

export const liveRouter = Router();
const id = z.string().regex(/^\d+$/);

liveRouter.get("/batches", async (req, res, next) => {
  try {
    const bundleId = id.parse(String(req.query.bundle_id ?? ""));
    if (!config.PSNA_BUNDLE_IDS.includes(bundleId)) return res.status(403).json({ error: "BUNDLE_NOT_ALLOWED" });
    res.json(await listBatches(bundleId));
  } catch (error) { next(error); }
});

liveRouter.get("/batches/:batchId/students", async (req, res, next) => {
  try {
    const batchId = id.parse(req.params.batchId);
    if (!config.PSNA_MASTER_BATCH_IDS.includes(batchId)) return res.status(403).json({ error: "BATCH_NOT_ALLOWED" });
    const { data, error } = await adminDb.from("edmingle_live_batches").select("roster_class_id")
      .eq("college_id", req.access!.collegeId).eq("master_batch_id", batchId).maybeSingle();
    if (error) throw error;
    if (!data) return res.status(409).json({ error: "RUN_ROSTER_SYNC_FIRST" });
    res.json(await getBatchStudents(batchId, data.roster_class_id));
  } catch (error) { next(error); }
});

async function classAllowed(collegeId: string, classId: string) {
  const { count, error } = await adminDb.from("edmingle_live_classes").select("class_id", { count: "exact", head: true })
    .eq("college_id", collegeId).eq("class_id", classId).eq("active", true);
  if (error) throw error;
  return Boolean(count);
}

liveRouter.get("/classes/:classId/material-progress", async (req, res, next) => {
  try {
    const classId = id.parse(req.params.classId);
    if (!await classAllowed(req.access!.collegeId, classId)) return res.status(403).json({ error: "CLASS_NOT_ALLOWED" });
    res.json(await getMaterialProgress(classId, id.parse(String(req.query.page ?? "1"))));
  } catch (error) { next(error); }
});

liveRouter.get("/classes/:classId/exercise-progress", async (req, res, next) => {
  try {
    const classId = id.parse(req.params.classId);
    if (!await classAllowed(req.access!.collegeId, classId)) return res.status(403).json({ error: "CLASS_NOT_ALLOWED" });
    res.json(await getExerciseProgress(classId, id.parse(String(req.query.page ?? "1"))));
  } catch (error) { next(error); }
});
