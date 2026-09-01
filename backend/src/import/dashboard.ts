import { adminDb } from "../supabase.js";
import { clean, parsePercent, sourceHash } from "../normalization.js";
import { readCsv, rowsToObjects } from "./csv.js";

export async function importDashboard(path: string, collegeId: string, dryRun = false) {
  const matrix = await readCsv(path);
  const headerIndex = matrix.findIndex(r => r[0] === "SNo." && r.includes("Learner Name"));
  if (headerIndex < 0) throw new Error("DASHBOARD_HEADER_NOT_FOUND");
  const records = rowsToObjects(matrix[headerIndex]!, matrix.slice(headerIndex + 1).filter(r => clean(r[1])));
  const submissions = records.map(r => ({
    college_id: collegeId,
    source_key: sourceHash(r["Learner Name"], r["Assessment name"], r["Latest Submissions"], r["Batch name"]),
    learner_name: clean(r["Learner Name"]),
    email: clean(r["Email"]) || null,
    mobile: clean(r["Mobile"]) || null,
    registration_number: clean(r["Reg No."]) || null,
    department_text: clean(r["Department"]) || null,
    college_text: clean(r["College"]) || null,
    batch_name: clean(r["Batch name"]),
    course_name: clean(r["Product name"]),
    assessment_name: clean(r["Assessment name"]),
    assessment_type: clean(r["Assessment type"]) || null,
    evaluation_status: clean(r["Evaluation status"]) || null,
    submitted_on_text: clean(r["Latest Submissions"]) || null,
    marks_obtained: Number(r["Marks obtained"] || 0),
    total_marks: Number(r["Total marks"] || 0),
    percentage: parsePercent(r["Percentage"]),
    raw_data: r
  }));
  if (!dryRun && submissions.length) {
    const { error } = await adminDb.from("edmingle_assessment_imports").upsert(submissions, { onConflict: "college_id,source_key" });
    if (error) throw error;
  }
  return { records: submissions.length, missingCollege: submissions.filter(x => !x.college_text).length, missingDepartment: submissions.filter(x => !x.department_text).length };
}
