import test from "node:test";
import assert from "node:assert/strict";
import { parseExerciseProgress, parseMaterialProgress, parseStudents, parseSubmissions } from "../src/edmingle/adapters.js";

test("parses Edmingle batch students", () => {
  const rows = parseStudents({ students: [{ user_id: 92682338, name: "Testing 4", registration_number: "241909776", progress: 72 }] });
  assert.equal(rows[0]?.edmingle_user_id, "92682338");
  assert.equal(rows[0]?.overall_progress, 72);
});

test("maps material attempts to completion", () => {
  const rows = parseMaterialProgress({ class_report: {
    assessment_names: [[608700, "Lesson PDF", 4, null]],
    section_colspan: [{ id: 99, name: "Unit I", colspan: 1 }],
    user_details: [{ user_id: 1, user_name: "Student", user_marks: [{ no_of_attempts: "1", passed: null, total_time_taken: "14" }] }]
  }});
  assert.equal(rows[0]?.status, "completed");
  assert.equal(rows[0]?.resource_name, "Lesson PDF");
  assert.equal(rows[0]?.section_name, "Unit I");
  assert.equal(rows[0]?.activity_kind, "material");
  assert.equal(rows[0]?.outcome, "completed");
});

test("preserves detailed Edmingle submission fields", () => {
  const rows = parseSubmissions({ submission: [{ id: 92682338, attempt_id: 19, assessment_id: 734,
    assessment_name: "Internal Quiz 1", assessment_type: 6, class_id: 624810,
    master_batch_id: 223571, course_id: 75113, course_name: "PSNA M3", marks_obtained: 13,
    total_marks: 15, percentage: "86.67", passed: 1, is_evaluated: 1,
    submission_time: "1787270400", name: "Testing 4", email: "student@example.com" }] });
  assert.equal(rows[0]?.attempt_id, "19");
  assert.equal(rows[0]?.percentage, 86.67);
  assert.equal(rows[0]?.evaluated, true);
  assert.equal(rows[0]?.passed, true);
  assert.equal(rows[0]?.submission_time, "2026-08-21T00:00:00.000Z");
});

test("computes competition ranks with ties", () => {
  const rows = parseExerciseProgress([{ class_report: {
    column_headers: [[734, "Internal Quiz", 5], [-1, "Grand Total", -1]],
    users: [[1, "A", "A1"], [2, "B", "B1"], [3, "C", "C1"]],
    user_marks: {
      "1": [{ gr: "100", mk: "15", tm: "15", atmpt: "1", pssd: "1" }, {}],
      "2": [{ gr: "100", mk: "15", tm: "15", atmpt: "1", pssd: "1" }, {}],
      "3": [{ gr: "80", mk: "12", tm: "15", atmpt: "1", pssd: "1" }, {}]
    }
  }}]);
  assert.deepEqual(rows.map(row => row.position), [1, 1, 3]);
});
