import { config } from "../config.js";
import { adminDb } from "../supabase.js";
import { getBatchStudents, getExerciseProgress, getMaterialProgress, getSubmissions, listBatches } from "../edmingle/client.js";
import { assertCompleteCatalog, parseBatchCatalog, type EdmingleBatch } from "../edmingle/catalog.js";
import { hasMorePages, parseExerciseProgress, parseMaterialProgress, parseStudents, parseSubmissions } from "../edmingle/adapters.js";

export type SyncMode = "roster" | "full" | "submissions";
export type SyncProgress = { stage: string; completed: number; total: number; detail?: string };
type ProgressHandler = (progress: SyncProgress) => void;

async function upsertChunks(table: string, rows: Record<string, unknown>[], onConflict: string, size = 500) {
  for (let index = 0; index < rows.length; index += size) {
    const { error } = await adminDb.from(table).upsert(rows.slice(index, index + size), { onConflict });
    if (error) throw error;
  }
}

async function fetchPages(fetchPage: (page: string) => Promise<unknown>) {
  const pages: unknown[] = [];
  for (let page = 1; page <= 100; page++) {
    const response = await fetchPage(String(page));
    pages.push(response);
    if (!hasMorePages(response)) return pages;
  }
  throw new Error("EDMINGLE_PAGINATION_LIMIT_EXCEEDED");
}

function wait(milliseconds: number) {
  return new Promise<void>(resolve => setTimeout(resolve, milliseconds));
}

async function retryEdmingle<T>(operation: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      const status = typeof error === "object" && error !== null && "status" in error
        ? Number((error as { status?: unknown }).status ?? 0)
        : 0;
      const isTimeout = error instanceof Error &&
        (error.name === "TimeoutError" || error.message.toLowerCase().includes("timeout"));
      const isTemporary = isTimeout || [429, 502, 503, 504].includes(status);

      if (!isTemporary || attempt === attempts) throw error;

      await wait(attempt * 15_000);
    }
  }

  throw lastError;
}

async function discoverCatalog(onProgress: ProgressHandler) {
  const batches: EdmingleBatch[] = [];
  for (let index = 0; index < config.PSNA_BUNDLE_IDS.length; index++) {
    const bundleId = config.PSNA_BUNDLE_IDS[index]!;
    onProgress({ stage: "catalog", completed: index, total: config.PSNA_BUNDLE_IDS.length, detail: `Course ${bundleId}` });
    batches.push(...parseBatchCatalog(await listBatches(bundleId)));
  }
  assertCompleteCatalog(batches);
  return batches;
}

export async function syncPsnaAnalytics(mode: SyncMode = "full", onProgress: ProgressHandler = () => {}) {
  const startedAt = new Date().toISOString();
  const { data: run, error: runError } = await adminDb.from("edmingle_live_sync_runs").insert({
    college_id: config.PSNA_COLLEGE_ID,
    sync_mode: mode,
    status: "running",
    started_at: startedAt
  }).select("id").single();
  if (runError) throw runError;

  let studentRows = 0;
  let contentRows = 0;
  let testRows = 0;
  let submissionRows = 0;
  try {
    const batches = await discoverCatalog(onProgress);
    const batchRows = batches.map(batch => ({
      college_id: config.PSNA_COLLEGE_ID,
      master_batch_id: batch.masterBatchId,
      bundle_id: batch.bundleId,
      bundle_name: batch.bundleName,
      batch_name: batch.name,
      department: batch.department,
      organization_id: batch.organizationId,
      admitted_students: batch.admittedStudents,
      roster_class_id: batch.rosterClassId,
      active: true,
      raw_data: batch.raw,
      synced_at: startedAt
    }));
    const classRows = batches.flatMap(batch => batch.classes.map(item => ({
      college_id: config.PSNA_COLLEGE_ID,
      class_id: item.classId,
      master_batch_id: batch.masterBatchId,
      bundle_id: batch.bundleId,
      class_name: item.name,
      class_kind: item.kind,
      reported_students: item.reportedStudents,
      active: true,
      raw_data: item.raw,
      synced_at: startedAt
    })));
    await upsertChunks("edmingle_live_batches", batchRows, "college_id,master_batch_id");
    await upsertChunks("edmingle_live_classes", classRows, "college_id,class_id");

    const allowedStudentIds = new Set<string>();
    for (let index = 0; index < batches.length; index++) {
      const batch = batches[index]!;
      onProgress({ stage: "students", completed: index, total: batches.length, detail: batch.department });
      const pages = await fetchPages(page => getBatchStudents(batch.masterBatchId, batch.rosterClassId, page, "100"));
      const students = pages.flatMap(parseStudents);
      students.forEach(student => allowedStudentIds.add(student.edmingle_user_id));
      await upsertChunks("edmingle_live_students", students.map(student => ({
        college_id: config.PSNA_COLLEGE_ID,
        edmingle_user_id: student.edmingle_user_id,
        name: student.name,
        email: student.email,
        mobile: student.mobile,
        registration_number: student.registration_number,
        active: true,
        raw_data: student.raw_data,
        synced_at: startedAt
      })), "college_id,edmingle_user_id");
      await upsertChunks("edmingle_live_student_batches", students.map(student => ({
        college_id: config.PSNA_COLLEGE_ID,
        edmingle_user_id: student.edmingle_user_id,
        master_batch_id: batch.masterBatchId,
        bundle_id: batch.bundleId,
        department: batch.department,
        overall_progress: student.overall_progress,
        attendance_percent: student.attendance_percent,
        synced_at: startedAt
      })), "college_id,edmingle_user_id,master_batch_id");
      studentRows += students.length;
    }

    if (mode === "full") {
      const classes = batches.flatMap(batch => batch.classes.map(item => ({ batch, item })));
      for (let index = 0; index < classes.length; index++) {
        const { batch, item } = classes[index]!;
        onProgress({ stage: "analytics", completed: index, total: classes.length, detail: `${batch.department}: ${item.name}` });

        const materialPages = await fetchPages(page => getMaterialProgress(item.classId, page, "100"));
        const material = materialPages.flatMap(parseMaterialProgress)
          .filter(row => allowedStudentIds.has(row.edmingle_user_id));
        const { error: clearMaterialError } = await adminDb.from("edmingle_live_content_progress")
          .delete().eq("college_id", config.PSNA_COLLEGE_ID).eq("class_id", item.classId);
        if (clearMaterialError) throw clearMaterialError;
        await upsertChunks("edmingle_live_content_progress", material.map(row => ({
          college_id: config.PSNA_COLLEGE_ID,
          edmingle_user_id: row.edmingle_user_id,
          master_batch_id: batch.masterBatchId,
          bundle_id: batch.bundleId,
          class_id: item.classId,
          resource_id: row.resource_id,
          resource_name: row.resource_name,
          resource_type: row.resource_type,
          section_id: row.section_id,
          section_name: row.section_name,
          activity_kind: row.activity_kind,
          outcome: row.outcome,
          status: row.status,
          attempts: row.attempts,
          total_time_seconds: row.total_time_seconds,
          raw_data: row.raw_data,
          synced_at: startedAt
        })), "college_id,edmingle_user_id,class_id,resource_id");
        contentRows += material.length;

        const exercisePages = await fetchPages(page => getExerciseProgress(item.classId, page, "100"));
        const tests = parseExerciseProgress(exercisePages)
          .filter(row => allowedStudentIds.has(row.edmingle_user_id));
        const { error: clearTestError } = await adminDb.from("edmingle_live_test_results")
          .delete().eq("college_id", config.PSNA_COLLEGE_ID).eq("class_id", item.classId);
        if (clearTestError) throw clearTestError;
        await upsertChunks("edmingle_live_test_results", tests.map(row => ({
          college_id: config.PSNA_COLLEGE_ID,
          edmingle_user_id: row.edmingle_user_id,
          master_batch_id: batch.masterBatchId,
          bundle_id: batch.bundleId,
          class_id: item.classId,
          resource_id: row.resource_id,
          resource_name: row.resource_name,
          resource_type: row.resource_type,
          marks_obtained: row.marks_obtained,
          total_marks: row.total_marks,
          percentage: row.percentage,
          position: row.position,
          attempts: row.attempts,
          passed: row.passed,
          total_time_seconds: row.total_time_seconds,
          raw_data: row.raw_data,
          synced_at: startedAt
        })), "college_id,edmingle_user_id,class_id,resource_id");
        testRows += tests.length;
      }
    }

    if (mode === "full" || mode === "submissions") {
      const firstStart = Math.floor(
        Date.UTC(2026, 7, 1) / 1000
      );
      const finalEnd =
        Math.floor(Date.now() / 1000);
      const windowSeconds = 6 * 60 * 60;
      const totalWindows = Math.ceil(
        (finalEnd - firstStart + 1) / windowSeconds
      );

      let completedWindows = 0;

      for (
        let windowStart = firstStart;
        windowStart <= finalEnd;
        windowStart += windowSeconds
      ) {
        const windowEnd = Math.min(
          windowStart + windowSeconds - 1,
          finalEnd
        );

        onProgress({
          stage: "submissions",
          completed: completedWindows,
          total: totalWindows,
          detail: `${new Date(windowStart * 1000).toISOString()} to ${new Date(windowEnd * 1000).toISOString()}`
        });

        const submissionPages = await fetchPages(page =>
          retryEdmingle(
            () => getSubmissions(
              String(windowStart),
              String(windowEnd),
              page
            ),
            3
          )
        );

        const submissions = submissionPages
          .flatMap(parseSubmissions)
          .filter(row =>
            allowedStudentIds.has(
              row.edmingle_user_id
            ) &&
            config.PSNA_MASTER_BATCH_IDS.includes(
              row.master_batch_id
            )
          );

        await upsertChunks(
          "edmingle_live_submissions",
          submissions.map(row => ({
            college_id: config.PSNA_COLLEGE_ID,
            ...row,
            raw_data: row.raw_data,
            synced_at: startedAt
          })),
          "college_id,attempt_id"
        );

        submissionRows += submissions.length;
        completedWindows++;
      }
    }

    await adminDb.from("edmingle_live_sync_runs").update({
      status: "completed",
      batches_synced: batches.length,
      students_synced: studentRows,
      content_rows_synced: contentRows,
      test_rows_synced: testRows,
      submissions_synced: submissionRows,
      completed_at: new Date().toISOString()
    }).eq("id", run.id);

    // The dashboard reads from materialized views (edmingle_live_student_metrics,
    // edmingle_live_resource_metrics) for speed. Refresh them now so the new
    // data is visible right away instead of waiting for the next sync.
    onProgress({ stage: "refreshing_analytics", completed: 0, total: 1, detail: "Refreshing dashboard views" });
    const { error: refreshError } = await adminDb.rpc("refresh_edmingle_live_metrics");
    if (refreshError) throw refreshError;

    onProgress({ stage: "completed", completed: 1, total: 1 });
    return { runId: run.id, batches: batches.length, studentRows, uniqueStudents: allowedStudentIds.size, contentRows, testRows, submissionRows };
  } catch (error) {
    await adminDb.from("edmingle_live_sync_runs").update({
      status: "failed",
      error_summary: error instanceof Error ? error.message.slice(0, 500) : "Unknown sync error",
      completed_at: new Date().toISOString()
    }).eq("id", run.id);
    throw error;
  }
}
