import { Router } from "express";
import { z } from "zod";
import { adminDb } from "../supabase.js";
import { getAssignmentAttemptDetails, getExerciseAttemptDetails, getMaterialViews } from "../edmingle/client.js";

export const dashboardRouter = Router();

const paging = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().trim().max(100).optional(),
  department: z.string().trim().max(100).optional(),
  master_batch_id: z.string().regex(/^\d+$/).optional(),
  resource_id: z.string().regex(/^\d+$/).optional()
});

const average = (values: Array<number | null | undefined>) => {
  const valid = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  return valid.length ? Math.round(valid.reduce((sum, value) => sum + value, 0) / valid.length * 100) / 100 : null;
};

const csvCell = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
const csv = (rows: unknown[][]) => "\uFEFF" + rows.map(row => row.map(csvCell).join(",")).join("\r\n");
const download = (res: import("express").Response, filename: string, rows: unknown[][]) => {
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(csv(rows));
};
const displayOutcome = (activity: unknown, outcome: unknown, status: unknown) => {
  if (outcome === "passed") return "Passed";
  if (outcome === "failed") return "Failed";
  if (outcome === "not_attempted" || status === "not_attempted") return String(activity) === "material" ? "Not Completed" : "Not Attempted";
  if (status === "completed") return "Completed";
  return "Not Completed";
};
const assessmentType = (value: unknown) => ["5", "6", "exercise", "quiz"].includes(String(value).toLowerCase()) ? "Online exercise" : String(value || "Assessment");

async function fetchAll(table: string, columns: string, collegeId: string) {
  const rows: Record<string, unknown>[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await adminDb.from(table).select(columns).eq("college_id", collegeId).range(from, from + 999);
    if (error) throw error;
    rows.push(...((data ?? []) as unknown as Record<string, unknown>[]));
    if (!data || data.length < 1000) return rows;
  }
}

async function fetchEveryRange(build: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: unknown }>) {
  const rows: Record<string, any>[] = [];
  for (let from = 0; ; from += 1000) {
    const result = await build(from, from + 999);
    if (result.error) throw result.error;
    const page = (result.data ?? []) as Record<string, any>[];
    rows.push(...page);
    if (page.length < 1000) return rows;
  }
}

dashboardRouter.get("/summary", async (req, res, next) => {
  try {
    const collegeId = req.access!.collegeId;
    const [studentRows, batches, testRows, sync] = await Promise.all([
      fetchAll("edmingle_live_student_metrics", "average_completion,verified_completion,department", collegeId),
      adminDb.from("edmingle_live_batches").select("master_batch_id", { count: "exact", head: true }).eq("college_id", collegeId).eq("active", true),
      fetchAll("edmingle_live_test_results", "percentage,attempts,resource_id,edmingle_user_id", collegeId),
      adminDb.from("edmingle_live_sync_runs").select("status,sync_mode,started_at,completed_at,error_summary").eq("college_id", collegeId).order("started_at", { ascending: false }).limit(1).maybeSingle()
    ]);
    for (const result of [batches, sync]) if (result.error) throw result.error;
    const completion = studentRows.flatMap(row => {
      const raw = row.verified_completion ?? row.average_completion;
      return raw == null ? [] : [Number(raw)];
    });
    const departments = new Map<string, number[]>();
    for (const row of studentRows) {
      for (const department of String(row.department ?? "Unassigned").split(",").map(value => value.trim())) {
        const values = departments.get(department) ?? [];
        const raw = row.verified_completion ?? row.average_completion;
        if (raw != null) {
          const value = Number(raw);
          if (Number.isFinite(value)) values.push(value);
        }
        departments.set(department, values);
      }
    }
    res.json({
      collegeId,
      role: req.access!.role,
      totalLearners: studentRows.length,
      activeBatches: batches.count ?? 0,
      averageContentCompletion: average(completion),
      assessmentAverage: average(testRows.filter(row => Number(row.attempts) > 0 && row.percentage != null).map(row => Number(row.percentage))),
      assessedAttempts: testRows.filter(row => Number(row.attempts) > 0 && row.percentage != null).length,
      uniqueAssessedLearners: new Set(testRows.filter(row => Number(row.attempts) > 0).map(row => String(row.edmingle_user_id))).size,
      assessmentCount: new Set(testRows.map(row => String(row.resource_id))).size,
      highestAssessmentPercentage: Math.max(0, ...testRows.filter(row => Number(row.attempts) > 0).map(row => Number(row.percentage) || 0)),
      needAttention: completion.filter(value => Number.isFinite(value) && value < 50).length,
      departments: [...departments.entries()].map(([department, values]) => ({ department, completion: average(values), learners: values.length })).sort((a, b) => (b.completion ?? 0) - (a.completion ?? 0)),
      lastSync: sync.data ?? null
    });
  } catch (error) { next(error); }
});

dashboardRouter.get("/students", async (req, res, next) => {
  try {
    const query = paging.parse(req.query);
    const from = (query.page - 1) * query.limit;
    let request = adminDb.from("edmingle_live_student_metrics")
      .select("edmingle_user_id,name,registration_number,master_batch_ids,department,batch_name,average_completion,verified_completion,completed_items,incomplete_items,not_started_items,content_items,assessments_assigned,assessments_attempted,assessments_passed,assessment_average,synced_at", { count: "exact" })
      .eq("college_id", req.access!.collegeId);
    if (query.master_batch_id) request = request.ilike("master_batch_ids", `%${query.master_batch_id}%`);
    if (query.department) request = request.ilike("department", `%${query.department.replace(/[%_,()]/g, "")}%`);
    if (query.search) {
      const search = query.search.replace(/[%_,()]/g, "");
      request = request.or(`name.ilike.%${search}%,registration_number.ilike.%${search}%`);
    }
    const { data, count, error } = await request.order("name").range(from, from + query.limit - 1);
    if (error) throw error;
    const userIds = (data ?? []).map(row => row.edmingle_user_id);
    const latestTests = userIds.length ? await adminDb.from("edmingle_live_test_rankings")
      .select("edmingle_user_id,resource_name,percentage,position,marks_obtained,total_marks,synced_at")
      .eq("college_id", req.access!.collegeId).in("edmingle_user_id", userIds).gt("attempts", 0)
      .order("synced_at", { ascending: false }) : { data: [], error: null };
    if (latestTests.error) throw latestTests.error;
    const byStudent = new Map<string, Record<string, unknown>>();
    for (const test of latestTests.data ?? []) if (!byStudent.has(test.edmingle_user_id)) byStudent.set(test.edmingle_user_id, test);
    const total = count ?? 0;
    res.json({ page: query.page, limit: query.limit, total, hasMore: from + (data?.length ?? 0) < total, data: (data ?? []).map(row => ({ ...row, latestTest: byStudent.get(row.edmingle_user_id) ?? null })) });
  } catch (error) { next(error); }
});

dashboardRouter.get("/students/:studentId/details", async (req, res, next) => {
  try {
    const studentId = z.string().regex(/^\d+$/).parse(req.params.studentId);
    const collegeId = req.access!.collegeId;
    const [student, profile, content, assessments, submissions] = await Promise.all([
      adminDb.from("edmingle_live_student_metrics").select("*").eq("college_id", collegeId).eq("edmingle_user_id", studentId).maybeSingle(),
      adminDb.from("edmingle_live_students").select("email,mobile").eq("college_id", collegeId).eq("edmingle_user_id", studentId).maybeSingle(),
      adminDb.from("edmingle_live_content_progress").select("class_id,resource_id,resource_name,resource_type,section_id,section_name,activity_kind,status,outcome,attempts,total_time_seconds,synced_at").eq("college_id", collegeId).eq("edmingle_user_id", studentId).order("section_name").order("resource_name").limit(5000),
      adminDb.from("edmingle_live_test_results").select("class_id,resource_id,resource_name,marks_obtained,total_marks,percentage,position,attempts,passed,total_time_seconds,synced_at").eq("college_id", collegeId).eq("edmingle_user_id", studentId).order("resource_name").limit(5000),
      adminDb.from("edmingle_live_submissions").select("attempt_id,assessment_id,assessment_name,assessment_type,class_id,master_batch_id,course_name,marks_obtained,total_marks,percentage,passed,evaluated,submission_time,synced_at").eq("college_id", collegeId).eq("edmingle_user_id", studentId).order("submission_time", { ascending: false }).limit(5000)
    ]);
    for (const result of [student, profile, content, assessments, submissions]) if (result.error) throw result.error;
    if (!student.data) return res.status(404).json({ error: "LEARNER_NOT_FOUND" });
    const topics = new Map<string, { topicId: string | null; topicName: string; assigned: number; completed: number; incomplete: number; materials: Array<Record<string, unknown>> }>();
    for (const row of content.data ?? []) {
      const key = row.section_id || `class:${row.class_id}`;
      const topic = topics.get(key) ?? { topicId: row.section_id, topicName: row.section_name || "Other materials", assigned: 0, completed: 0, incomplete: 0, materials: [] as Array<Record<string, unknown>> };
      topic.assigned += 1;
      if (row.status === "completed") topic.completed += 1; else topic.incomplete += 1;
      topic.materials.push(row);
      topics.set(key, topic);
    }
    res.json({ student: { ...student.data, ...profile.data }, topics: [...topics.values()].map(topic => ({ ...topic, completion: topic.assigned ? Math.round(10000 * topic.completed / topic.assigned) / 100 : 0 })), assessments: assessments.data ?? [], submissions: submissions.data ?? [] });
  } catch (error) { next(error); }
});

dashboardRouter.get("/students/:studentId/materials/:materialId/views", async (req, res, next) => {
  try {
    const studentId = z.string().regex(/^\d+$/).parse(req.params.studentId);
    const materialId = z.string().regex(/^\d+$/).parse(req.params.materialId);
    const classId = z.string().regex(/^\d+$/).parse(req.query.class_id);
    const permitted = await adminDb.from("edmingle_live_content_progress").select("id").eq("college_id", req.access!.collegeId).eq("edmingle_user_id", studentId).eq("resource_id", materialId).eq("class_id", classId).maybeSingle();
    if (permitted.error) throw permitted.error;
    if (!permitted.data) return res.status(404).json({ error: "MATERIAL_NOT_FOUND" });
    res.json(await getMaterialViews(materialId, studentId, classId));
  } catch (error) { next(error); }
});

dashboardRouter.get("/students/:studentId/attempts/:attemptId/details", async (req, res, next) => {
  try {
    const studentId = z.string().regex(/^\d+$/).parse(req.params.studentId);
    const attemptId = z.string().regex(/^\d+$/).parse(req.params.attemptId);
    const submission = await adminDb.from("edmingle_live_submissions").select("assessment_type").eq("college_id", req.access!.collegeId).eq("edmingle_user_id", studentId).eq("attempt_id", attemptId).maybeSingle();
    if (submission.error) throw submission.error;
    if (!submission.data) return res.status(404).json({ error: "ATTEMPT_NOT_FOUND" });
    const assignmentTypes = new Set(["7", "assignment"]);
    res.json(await (assignmentTypes.has(String(submission.data.assessment_type)) ? getAssignmentAttemptDetails(attemptId) : getExerciseAttemptDetails(attemptId)));
  } catch (error) { next(error); }
});

dashboardRouter.get("/submissions", async (req, res, next) => {
  try {
    const query = paging.parse(req.query); const from = (query.page - 1) * query.limit;
    let request = adminDb.from("edmingle_live_submissions").select("attempt_id,assessment_id,assessment_name,assessment_type,class_id,master_batch_id,course_name,edmingle_user_id,learner_name,email,mobile,marks_obtained,total_marks,percentage,passed,evaluated,submission_time", { count: "exact" }).eq("college_id", req.access!.collegeId);
    if (query.master_batch_id) request = request.eq("master_batch_id", query.master_batch_id);
    if (query.search) { const search=query.search.replace(/[%_,()]/g, ""); request=request.or(`learner_name.ilike.%${search}%,assessment_name.ilike.%${search}%`); }
    const { data, count, error } = await request.order("submission_time", { ascending: false }).range(from, from + query.limit - 1);
    if (error) throw error; const total=count ?? 0;
    res.json({ page: query.page, limit: query.limit, total, hasMore: from + (data?.length ?? 0) < total, data });
  } catch (error) { next(error); }
});

dashboardRouter.get("/exports/content-progress", async (req, res, next) => {
  try {
    const batchId = z.string().regex(/^\d+$/).parse(req.query.master_batch_id);
    const collegeId = req.access!.collegeId;
    const [studentRows, progressRows] = await Promise.all([
      fetchEveryRange((from, to) => adminDb.from("edmingle_live_student_batches").select("edmingle_user_id,overall_progress").eq("college_id", collegeId).eq("master_batch_id", batchId).order("edmingle_user_id").range(from, to)),
      fetchEveryRange((from, to) => adminDb.from("edmingle_live_content_progress").select("edmingle_user_id,class_id,resource_id,resource_name,activity_kind,outcome,status").eq("college_id", collegeId).eq("master_batch_id", batchId).order("class_id").order("resource_name").order("edmingle_user_id").range(from, to))
    ]);
    const ids = studentRows.map(row => row.edmingle_user_id);
    const profiles = ids.length ? await adminDb.from("edmingle_live_students").select("edmingle_user_id,name,email,mobile,registration_number").eq("college_id", collegeId).in("edmingle_user_id", ids).limit(1000) : { data: [], error: null };
    if (profiles.error) throw profiles.error;
    const resources = new Map<string, string>();
    for (const row of progressRows) resources.set(`${row.class_id}:${row.resource_id}`, row.resource_name);
    const resourceEntries = [...resources.entries()];
    const values = new Map<string, string>();
    for (const row of progressRows) values.set(`${row.edmingle_user_id}:${row.class_id}:${row.resource_id}`, displayOutcome(row.activity_kind, row.outcome, row.status));
    const progress = new Map(studentRows.map(row => [row.edmingle_user_id, row.overall_progress]));
    const rows: unknown[][] = [["Name", "Email", "Contact Number", "Registration Number", "Average Completion", ...resourceEntries.map(([, name]) => name)]];
    for (const profile of (profiles.data ?? []).sort((a, b) => a.name.localeCompare(b.name))) {
      rows.push([profile.name, profile.email, profile.mobile, profile.registration_number, `${Number(progress.get(profile.edmingle_user_id) ?? 0)}%`, ...resourceEntries.map(([key]) => values.get(`${profile.edmingle_user_id}:${key}`) ?? "Not Attempted")]);
    }
    download(res, `PSNA-Content-Progress-Report-${batchId}.csv`, rows);
  } catch (error) { next(error); }
});

dashboardRouter.get("/exports/learner-summary", async (req, res, next) => {
  try {
    const query = paging.parse(req.query);
    const data = await fetchEveryRange((from, to) => {
      let request = adminDb.from("edmingle_live_student_metrics").select("name,registration_number,master_batch_ids,department,batch_name,completed_items,incomplete_items,not_started_items,content_items,verified_completion,average_completion,assessments_attempted,assessments_assigned,assessment_average").eq("college_id", req.access!.collegeId);
      if (query.master_batch_id) request = request.ilike("master_batch_ids", `%${query.master_batch_id}%`);
      if (query.department) request = request.ilike("department", `%${query.department.replace(/[%_,()]/g, "")}%`);
      if (query.search) { const search = query.search.replace(/[%_,()]/g, ""); request = request.or(`name.ilike.%${search}%,registration_number.ilike.%${search}%`); }
      return request.order("name").range(from, to);
    });
    download(res, "psna-learner-progress.csv", [["Learner", "Registration Number", "Department", "Batch", "Completed Items", "Incomplete Items", "Not Started Items", "Content Items Assigned", "Completion %", "Assessments Attempted", "Assessments Assigned", "Assessment Average %", "Status"], ...data.map(row => {
      const completion = Number(row.verified_completion ?? row.average_completion ?? 0);
      return [row.name, row.registration_number, row.department, row.batch_name, row.completed_items, row.incomplete_items, row.not_started_items, row.content_items, completion, row.assessments_attempted, row.assessments_assigned, row.assessment_average, completion >= 100 ? "Completed" : completion < 50 ? "Needs attention" : "In progress"];
    })]);
  } catch (error) { next(error); }
});

dashboardRouter.get("/exports/test-results", async (req, res, next) => {
  try {
    const query = paging.parse(req.query);
    let request = adminDb.from("edmingle_live_test_rankings").select("position,name,registration_number,department,batch_name,resource_name,marks_obtained,total_marks,percentage,attempts,passed").eq("college_id", req.access!.collegeId).gt("attempts", 0);
    if (query.master_batch_id) request = request.eq("master_batch_id", query.master_batch_id);
    if (query.department) request = request.eq("department", query.department);
    if (query.resource_id) request = request.eq("resource_id", query.resource_id);
    if (query.search) request = request.ilike("name", `%${query.search.replace(/[%_,()]/g, "")}%`);
    const { data, error } = await request.order("resource_name").order("position", { ascending: true, nullsFirst: false }).limit(100000);
    if (error) throw error;
    download(res, "psna-online-test-results.csv", [["Position", "Learner", "Registration Number", "Department", "Batch", "Assessment", "Marks", "Total Marks", "Percentage", "Attempts", "Passing Status"], ...(data ?? []).map(row => [row.position, row.name, row.registration_number, row.department, row.batch_name, row.resource_name, row.marks_obtained, row.total_marks, row.percentage, row.attempts, row.passed ? "Pass" : "Fail"])]);
  } catch (error) { next(error); }
});

dashboardRouter.get("/exports/quiz-submissions", async (req, res, next) => {
  try {
    const batchId = req.query.master_batch_id ? z.string().regex(/^\d+$/).parse(req.query.master_batch_id) : null;
    let request = adminDb.from("edmingle_live_submissions").select("learner_name,assessment_name,evaluated,submission_time,email,mobile,assessment_type,marks_obtained,total_marks,percentage").eq("college_id", req.access!.collegeId);
    if (batchId) request = request.eq("master_batch_id", batchId);
    const { data, error } = await request.order("submission_time", { ascending: false }).limit(100000);
    if (error) throw error;
    download(res, "psna-quiz-submissions.csv", [["Learner Name", "Assessment Name", "Evaluation status", "Submission date", "Timeliness", "Email", "Contact Number", "Assessment type", "Marks Obtained", "Total marks", "Percentage"], ...(data ?? []).map(row => [row.learner_name, row.assessment_name, row.evaluated ? "EVALUATED" : "NOT EVALUATED", row.submission_time ? new Date(row.submission_time).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit", timeZone: "Asia/Kolkata" }).replaceAll(" ", "-") : "", "", row.email, row.mobile, assessmentType(row.assessment_type), row.marks_obtained, row.total_marks, row.percentage == null ? "" : `${Number(row.percentage).toFixed(2)}%`])]);
  } catch (error) { next(error); }
});

dashboardRouter.get("/exports/attempt-report", async (req, res, next) => {
  try {
    const resourceId = z.string().regex(/^\d+$/).parse(req.query.resource_id);
    const collegeId = req.access!.collegeId;
    const [tests, submissions] = await Promise.all([
      adminDb.from("edmingle_live_test_results").select("edmingle_user_id,marks_obtained,total_marks,percentage,passed,total_time_seconds,raw_data").eq("college_id", collegeId).eq("resource_id", resourceId).gt("attempts", 0).limit(10000),
      adminDb.from("edmingle_live_submissions").select("edmingle_user_id,submission_time").eq("college_id", collegeId).eq("assessment_id", resourceId).limit(10000)
    ]);
    if (tests.error) throw tests.error;
    if (submissions.error) throw submissions.error;
    const learnerIds = (tests.data ?? []).map(row => row.edmingle_user_id);
    const learners = learnerIds.length ? await adminDb.from("edmingle_live_students").select("edmingle_user_id,name").eq("college_id", collegeId).in("edmingle_user_id", learnerIds).limit(10000) : { data: [], error: null };
    if (learners.error) throw learners.error;
    const names = new Map((learners.data ?? []).map(row => [row.edmingle_user_id, row.name]));
    const dates = new Map((submissions.data ?? []).map(row => [row.edmingle_user_id, row.submission_time]));
    download(res, `psna-attempt-report-${resourceId}.csv`, [["Name", "Test Date", "Marks", "Total Mark", "Percentage", "Passing Status", "Time (in seconds)", "Part A_Marks", "Part A_Total Marks"], ...(tests.data ?? []).map(row => {
      const date = dates.get(row.edmingle_user_id);
      const raw = row.raw_data && typeof row.raw_data === "object" ? row.raw_data as Record<string, unknown> : {};
      return [names.get(row.edmingle_user_id) ?? row.edmingle_user_id, date ? new Date(date).toLocaleString("en-GB", { timeZone: "Asia/Kolkata", hour12: false }).replace(",", "") : "", row.marks_obtained, row.total_marks, row.percentage, row.passed ? "Pass" : "Fail", row.total_time_seconds, raw.part_a_marks ?? row.marks_obtained, raw.part_a_total_marks ?? row.total_marks];
    })]);
  } catch (error) { next(error); }
});

dashboardRouter.get("/content", async (req, res, next) => {
  try {
    const query = paging.parse(req.query);
    const from = (query.page - 1) * query.limit;
    let request = adminDb.from("edmingle_live_resource_metrics")
      .select("bundle_id,master_batch_id,class_id,resource_id,resource_name,resource_type,department,batch_name,class_name,learner_count,completed_count,completion_percentage,synced_at", { count: "exact" })
      .eq("college_id", req.access!.collegeId);
    if (query.department) request = request.eq("department", query.department);
    if (query.master_batch_id) request = request.eq("master_batch_id", query.master_batch_id);
    if (query.search) request = request.ilike("resource_name", `%${query.search.replace(/[%_,()]/g, "")}%`);
    const { data, count, error } = await request.order("completion_percentage", { ascending: true }).range(from, from + query.limit - 1);
    if (error) throw error;
    const total = count ?? 0;
    res.json({ page: query.page, limit: query.limit, total, hasMore: from + (data?.length ?? 0) < total, data });
  } catch (error) { next(error); }
});

dashboardRouter.get("/tests", async (req, res, next) => {
  try {
    const query = paging.parse(req.query);
    const from = (query.page - 1) * query.limit;
    let request = adminDb.from("edmingle_live_test_rankings")
      .select("bundle_id,master_batch_id,class_id,resource_id,resource_name,edmingle_user_id,name,registration_number,department,batch_name,marks_obtained,total_marks,percentage,position,attempts,passed,synced_at", { count: "exact" })
      .eq("college_id", req.access!.collegeId).gt("attempts", 0);
    if (query.department) request = request.eq("department", query.department);
    if (query.master_batch_id) request = request.eq("master_batch_id", query.master_batch_id);
    if (query.resource_id) request = request.eq("resource_id", query.resource_id);
    if (query.search) request = request.ilike("name", `%${query.search.replace(/[%_,()]/g, "")}%`);
    const { data, count, error } = await request.order("position", { ascending: true, nullsFirst: false }).order("name").range(from, from + query.limit - 1);
    if (error) throw error;
    const total = count ?? 0;
    res.json({ page: query.page, limit: query.limit, total, hasMore: from + (data?.length ?? 0) < total, data });
  } catch (error) { next(error); }
});

dashboardRouter.get("/batches", async (req, res, next) => {
  try {
    const { data, error } = await adminDb.from("edmingle_live_batches")
      .select("bundle_id,bundle_name,master_batch_id,batch_name,department,admitted_students,synced_at")
      .eq("college_id", req.access!.collegeId).eq("active", true).order("bundle_id").order("department");
    if (error) throw error;
    res.json({ data });
  } catch (error) { next(error); }
});
