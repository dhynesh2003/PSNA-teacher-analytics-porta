type PageContext = { page?: number; per_page?: number; has_more_page?: boolean; total_rows?: number | string };

const text = (value: unknown) => String(value ?? "").trim();
const numeric = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};
const bool = (value: unknown) => value === true || value === 1 || value === "1";

export function hasMorePages(payload: unknown) {
  return Boolean((payload as { page_context?: PageContext })?.page_context?.has_more_page);
}

export type StudentRecord = {
  edmingle_user_id: string;
  name: string;
  email: string | null;
  mobile: string | null;
  registration_number: string | null;
  overall_progress: number | null;
  attendance_percent: number | null;
  raw_data: unknown;
};

export function parseStudents(payload: unknown): StudentRecord[] {
  const rows = (payload as { students?: Array<Record<string, unknown>> })?.students;
  if (!Array.isArray(rows)) throw new Error("EDMINGLE_STUDENT_SCHEMA_INVALID");
  return rows.flatMap(row => {
    const userId = text(row.user_id);
    const name = text(row.name);
    if (!/^\d+$/.test(userId) || !name) return [];
    return [{
      edmingle_user_id: userId,
      name,
      email: text(row.email) || null,
      mobile: text(row.contact_number) || null,
      registration_number: text(row.registration_number) || null,
      overall_progress: numeric(row.progress),
      attendance_percent: numeric(row.attendance_percent),
      raw_data: row
    }];
  });
}

export type ContentProgressRecord = {
  edmingle_user_id: string;
  resource_id: string;
  resource_name: string;
  resource_type: string;
  section_id: string | null;
  section_name: string | null;
  activity_kind: "material" | "quiz" | "exercise" | "assignment";
  outcome: "completed" | "not_completed" | "passed" | "failed" | "not_attempted" | "unknown";
  status: "completed" | "not_completed" | "not_attempted" | "unknown";
  attempts: number;
  total_time_seconds: number | null;
  raw_data: unknown;
};

export function parseMaterialProgress(payload: unknown): ContentProgressRecord[] {
  const report = (payload as { class_report?: Record<string, unknown> })?.class_report;
  const resources = report?.assessment_names;
  const users = report?.user_details;
  if (!Array.isArray(resources) || !Array.isArray(users)) return [];
  const definitions = resources.map(item => Array.isArray(item) ? {
    id: text(item[0]), name: text(item[1]), type: text(item[2]) || "4"
  } : null);
  const sectionByIndex = new Map<number, { id: string | null; name: string | null }>();
  let resourceIndex = 0;
  const sections = Array.isArray(report?.section_colspan) ? report.section_colspan : [];
  for (const rawSection of sections) {
    if (!rawSection || typeof rawSection !== "object") continue;
    const section = rawSection as Record<string, unknown>;
    const count = Math.max(0, numeric(section.colspan) ?? 0);
    for (let index = resourceIndex; index < resourceIndex + count; index += 1) {
      sectionByIndex.set(index, { id: text(section.id) || null, name: text(section.name) || null });
    }
    resourceIndex += count;
  }
  const output: ContentProgressRecord[] = [];
  for (const rawUser of users) {
    if (!rawUser || typeof rawUser !== "object") continue;
    const user = rawUser as Record<string, unknown>;
    const userId = text(user.user_id);
    const marks = Array.isArray(user.user_marks) ? user.user_marks : [];
    if (!/^\d+$/.test(userId)) continue;
    definitions.forEach((resource, index) => {
      if (!resource?.id) return;
      const raw = marks[index];
      const mark = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
      const attempts = numeric(mark.no_of_attempts) ?? 0;
      const totalTime = numeric(mark.total_time_taken);
      const attempted = attempts > 0 || (totalTime ?? 0) > 0 || mark.passed != null || mark.grade != null;
      const completed = bool(mark.passed) || (mark.passed == null && attempted);
      const activityKind = /assignment/i.test(resource.name) ? "assignment" : /exercise/i.test(resource.name) ? "exercise" : /quiz|test/i.test(resource.name) ? "quiz" : "material";
      const outcome = !attempted ? "not_attempted" : activityKind === "material" ? (completed ? "completed" : "not_completed") : bool(mark.passed) ? "passed" : "failed";
      output.push({
        edmingle_user_id: userId,
        resource_id: resource.id,
        resource_name: resource.name || `Resource ${resource.id}`,
        resource_type: resource.type,
        section_id: sectionByIndex.get(index)?.id ?? null,
        section_name: sectionByIndex.get(index)?.name ?? null,
        activity_kind: activityKind,
        outcome,
        status: completed ? "completed" : attempted ? "not_completed" : "not_attempted",
        attempts,
        total_time_seconds: totalTime,
        raw_data: mark
      });
    });
  }
  return output;
}

export type TestResultRecord = {
  edmingle_user_id: string;
  learner_name: string;
  resource_id: string;
  resource_name: string;
  resource_type: string;
  marks_obtained: number | null;
  total_marks: number | null;
  percentage: number | null;
  position: number | null;
  attempts: number;
  passed: boolean | null;
  total_time_seconds: number | null;
  raw_data: unknown;
};

export function parseExerciseProgress(payloads: unknown[]): TestResultRecord[] {
  const results: TestResultRecord[] = [];
  for (const payload of payloads) {
    const report = (payload as { class_report?: Record<string, unknown> })?.class_report;
    const headers = report?.column_headers;
    const users = report?.users;
    const marksByUser = report?.user_marks;
    if (!Array.isArray(headers) || !Array.isArray(users) || !marksByUser || typeof marksByUser !== "object") continue;
    const resources = headers.map(item => Array.isArray(item) ? {
      id: text(item[0]), name: text(item[1]), type: text(item[2])
    } : null);
    for (const rawUser of users) {
      if (!Array.isArray(rawUser)) continue;
      const userId = text(rawUser[0]);
      const learnerName = text(rawUser[1]);
      const marks = (marksByUser as Record<string, unknown>)[userId];
      if (!/^\d+$/.test(userId) || !Array.isArray(marks)) continue;
      resources.forEach((resource, index) => {
        if (!resource?.id || resource.id === "-1") return;
        const raw = marks[index];
        const mark = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
        results.push({
          edmingle_user_id: userId,
          learner_name: learnerName,
          resource_id: resource.id,
          resource_name: resource.name || `Assessment ${resource.id}`,
          resource_type: resource.type || "5",
          marks_obtained: numeric(mark.mk),
          total_marks: numeric(mark.tm),
          percentage: numeric(mark.gr),
          position: null,
          attempts: numeric(mark.atmpt) ?? 0,
          passed: mark.pssd == null ? null : bool(mark.pssd),
          total_time_seconds: numeric(mark.tttm),
          raw_data: mark
        });
      });
    }
  }

  const groups = new Map<string, TestResultRecord[]>();
  for (const result of results) {
    const group = groups.get(result.resource_id) ?? [];
    group.push(result);
    groups.set(result.resource_id, group);
  }
  for (const group of groups.values()) {
    const attempted = group.filter(item => item.attempts > 0 && item.percentage !== null)
      .sort((a, b) => (b.percentage ?? 0) - (a.percentage ?? 0));
    let previous: number | null = null;
    let rank = 0;
    attempted.forEach((item, index) => {
      if (item.percentage !== previous) rank = index + 1;
      item.position = rank;
      previous = item.percentage;
    });
  }
  return results;
}

export type SubmissionRecord = {
  edmingle_user_id: string; attempt_id: string; assessment_id: string; assessment_name: string;
  assessment_type: string; class_id: string; master_batch_id: string; course_id: string | null;
  course_name: string | null; marks_obtained: number | null; total_marks: number | null;
  percentage: number | null; passed: boolean | null; evaluated: boolean; submission_time: string | null;
  learner_name: string; email: string | null; mobile: string | null; raw_data: unknown;
};

export function parseSubmissions(payload: unknown): SubmissionRecord[] {
  const rows = (payload as { submission?: Array<Record<string, unknown>> })?.submission;
  if (!Array.isArray(rows)) return [];
  return rows.flatMap(row => {
    const userId = text(row.id ?? row.user_id);
    const attemptId = text(row.attempt_id);
    const assessmentId = text(row.assessment_id);
    const classId = text(row.class_id);
    const batchId = text(row.master_batch_id);
    if (!/^\d+$/.test(userId) || !attemptId || !assessmentId || !classId || !batchId) return [];
    const epoch = numeric(row.submission_time);
    return [{
      edmingle_user_id: userId, attempt_id: attemptId, assessment_id: assessmentId,
      assessment_name: text(row.assessment_name) || `Assessment ${assessmentId}`,
      assessment_type: text(row.assessment_type) || "unknown", class_id: classId,
      master_batch_id: batchId, course_id: text(row.course_id) || null,
      course_name: text(row.course_name) || null, marks_obtained: numeric(row.marks_obtained),
      total_marks: numeric(row.total_marks), percentage: numeric(row.percentage),
      passed: row.passed == null ? null : bool(row.passed), evaluated: bool(row.is_evaluated),
      submission_time: epoch ? new Date(epoch * 1000).toISOString() : null,
      learner_name: text(row.name), email: text(row.email) || null,
      mobile: text(row.contact_number) || null, raw_data: row
    }];
  });
}
