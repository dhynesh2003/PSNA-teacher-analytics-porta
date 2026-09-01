import { config } from "../config.js";

export type EdmingleClass = {
  classId: string;
  masterBatchId: string;
  name: string;
  kind: "material" | "assessment";
  reportedStudents: number;
  raw: unknown;
};

export type EdmingleBatch = {
  bundleId: string;
  bundleName: string;
  masterBatchId: string;
  name: string;
  department: string;
  admittedStudents: number;
  organizationId: string;
  rosterClassId: string;
  classes: EdmingleClass[];
  raw: unknown;
};

type BatchResponse = {
  code?: number;
  courses?: Array<{
    bundle_id?: string | number;
    bundle_name?: string;
    batch?: Array<Record<string, unknown>>;
  }>;
};

const text = (value: unknown) => String(value ?? "").trim();
const number = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : 0;
const isAssessmentName = (name: string) => /quiz|test|assessment|exam|exercise/i.test(name);

function departmentFromBatch(name: string) {
  const match = name.match(/PSNA\s*-\s*(.+)$/i);
  return match?.[1]?.trim() || "Unassigned";
}

function parseClass(masterBatchId: string, raw: unknown): EdmingleClass | null {
  if (!Array.isArray(raw) || raw.length < 6) return null;
  const classId = text(raw[0]);
  const name = text(raw[5]);
  if (!/^\d+$/.test(classId) || !name) return null;
  return {
    classId,
    masterBatchId,
    name,
    kind: isAssessmentName(name) ? "assessment" : "material",
    reportedStudents: number(raw[1]),
    raw
  };
}

export function parseBatchCatalog(payload: unknown): EdmingleBatch[] {
  const response = payload as BatchResponse;
  if (response.code !== 200 || !Array.isArray(response.courses)) throw new Error("EDMINGLE_BATCH_SCHEMA_INVALID");
  const allowed = new Set(config.PSNA_MASTER_BATCH_IDS);
  const parsed: EdmingleBatch[] = [];

  for (const course of response.courses) {
    const bundleId = text(course.bundle_id);
    const bundleName = text(course.bundle_name);
    for (const raw of course.batch ?? []) {
      const masterBatchId = text(raw.class_id);
      if (!allowed.has(masterBatchId)) continue;
      const organizationId = text(raw.organization_id);
      if (organizationId !== config.EDMINGLE_PSNA_ORG_ID) {
        throw new Error(`PSNA_BATCH_ORGANIZATION_MISMATCH:${masterBatchId}`);
      }
      const classes = (Array.isArray(raw.classes) ? raw.classes : [])
        .map(item => parseClass(masterBatchId, item))
        .filter((item): item is EdmingleClass => item !== null);
      const rosterClass = classes.find(item => item.reportedStudents > 0 && item.kind === "material")
        ?? classes.find(item => item.reportedStudents > 0)
        ?? classes[0];
      if (!rosterClass) throw new Error(`PSNA_BATCH_HAS_NO_CLASS:${masterBatchId}`);
      const name = text(raw.class_name);
      parsed.push({
        bundleId,
        bundleName,
        masterBatchId,
        name,
        department: departmentFromBatch(name),
        admittedStudents: number(raw.admitted_students),
        organizationId,
        rosterClassId: rosterClass.classId,
        classes,
        raw
      });
    }
  }
  return parsed;
}

export function assertCompleteCatalog(batches: EdmingleBatch[]) {
  const found = new Set(batches.map(item => item.masterBatchId));
  const missing = config.PSNA_MASTER_BATCH_IDS.filter(id => !found.has(id));
  if (missing.length) throw new Error(`PSNA_MASTER_BATCHES_MISSING:${missing.join(",")}`);
}

