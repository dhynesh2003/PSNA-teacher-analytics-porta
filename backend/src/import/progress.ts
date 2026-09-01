import { adminDb } from "../supabase.js";
import { clean, parsePercent, progressStatus, sourceHash } from "../normalization.js";
import { readCsv } from "./csv.js";

export async function importProgress(path: string, collegeId: string, dryRun = false) {
  const matrix = await readCsv(path);
  const headerIndex = matrix.findIndex(r => r[0] === "Name" && r[4] === "Average Completion");
  if (headerIndex < 0) throw new Error("PROGRESS_HEADER_NOT_FOUND");
  const headers = matrix[headerIndex]!;
  const batchName = clean(matrix[0]?.[0]).replace(/^Batch Name\s*-\s*/i, "");
  const learners = matrix.slice(headerIndex + 1).filter(r => clean(r[0]));
  const summaryRows = [];
  const itemRows = [];
  for (const row of learners) {
    const learnerKey = sourceHash(batchName, row[3] || row[0], row[2]);
    summaryRows.push({
      college_id: collegeId, source_key: learnerKey, batch_name: batchName,
      learner_name: clean(row[0]), email: clean(row[1]) || null, mobile: clean(row[2]) || null,
      registration_number: clean(row[3]) || null, average_completion: parsePercent(row[4]), raw_identity: row.slice(0, 5)
    });
    for (let i = 5; i < headers.length; i++) {
      const contentName = clean(headers[i]);
      if (!contentName) continue;
      itemRows.push({
        college_id: collegeId, learner_source_key: learnerKey, batch_name: batchName,
        content_source_key: sourceHash(batchName, contentName, i), content_name: contentName,
        content_position: i, status: progressStatus(row[i]), source_value: clean(row[i]) || null
      });
    }
  }
  if (!dryRun) {
    const { error: sError } = await adminDb.from("edmingle_progress_imports").upsert(summaryRows, { onConflict: "college_id,source_key" });
    if (sError) throw sError;
    for (let i = 0; i < itemRows.length; i += 1000) {
      const { error } = await adminDb.from("edmingle_progress_item_imports").upsert(itemRows.slice(i, i + 1000), { onConflict: "college_id,learner_source_key,content_source_key" });
      if (error) throw error;
    }
  }
  return { batchName, learners: summaryRows.length, contentItems: new Set(itemRows.map(x => x.content_source_key)).size, progressCells: itemRows.length };
}
