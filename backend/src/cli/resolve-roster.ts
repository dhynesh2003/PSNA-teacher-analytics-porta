import { adminDb } from "../supabase.js";
import { searchStudentByEmail } from "../edmingle/client.js";

const [collegeId, option] = process.argv.slice(2);
if (!collegeId) throw new Error("Usage: npm run resolve:roster -- COLLEGE_UUID [--dry-run]");
const dryRun = option === "--dry-run";

const { data: roster, error } = await adminDb
  .from("edmingle_student_roster")
  .select("id,email")
  .eq("college_id", collegeId)
  .eq("active", true)
  .is("edmingle_student_id", null)
  .not("email", "is", null);
if (error) throw error;

let matched = 0;
let unmatched = 0;
let ambiguous = 0;

for (const row of roster ?? []) {
  const email = String(row.email).trim().toLowerCase();
  const response = await searchStudentByEmail(email) as {
    user_details?: Array<{ student_id?: string | number; student_email?: string }>;
  };
  const exact = (response.user_details ?? []).filter(
    student => String(student.student_email ?? "").trim().toLowerCase() === email && student.student_id != null
  );
  const status = exact.length === 1 ? "matched" : exact.length > 1 ? "ambiguous" : "not_found";
  if (status === "matched") matched++;
  else if (status === "ambiguous") ambiguous++;
  else unmatched++;

  if (!dryRun) {
    const { error: updateError } = await adminDb
      .from("edmingle_student_roster")
      .update({
        edmingle_student_id: exact.length === 1 ? String(exact[0]!.student_id) : null,
        match_status: status,
        match_method: exact.length === 1 ? "exact_email" : null,
        verified_at: exact.length === 1 ? new Date().toISOString() : null
      })
      .eq("id", row.id);
    if (updateError) throw updateError;
  }
}

console.log({ processed: roster?.length ?? 0, matched, unmatched, ambiguous, dryRun });
