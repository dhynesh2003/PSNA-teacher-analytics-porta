"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Tab = "overview" | "progress" | "tests" | "submissions" | "students" | "sync";
type Summary = {
  role: string;
  totalLearners: number;
  activeBatches: number;
  averageContentCompletion: number | null;
  assessmentAverage: number | null;
  assessedAttempts: number;
  uniqueAssessedLearners?: number;
  assessmentCount?: number;
  highestAssessmentPercentage?: number;
  needAttention: number;
  departments: Array<{
    department: string;
    completion: number | null;
    learners: number;
  }>;
  lastSync: {
    status: string;
    sync_mode: string;
    started_at: string;
    completed_at: string | null;
    error_summary?: string | null;
  } | null;
};
type Student = {
  edmingle_user_id: string;
  name: string;
  registration_number: string | null;
  master_batch_ids?: string | null;
  department: string | null;
  batch_name: string | null;
  average_completion: number | null;
  verified_completion: number | null;
  completed_items: number;
  incomplete_items?: number;
  not_started_items?: number;
  content_items: number;
  assessments_assigned?: number;
  assessments_attempted?: number;
  assessments_passed?: number;
  assessment_average?: number | null;
  latestTest?: {
    resource_name: string;
    percentage: number | null;
    position: number | null;
    marks_obtained: number | null;
    total_marks: number | null;
  } | null;
};
type ContentRow = {
  master_batch_id: string;
  class_id: string;
  resource_id: string;
  resource_name: string;
  resource_type: string;
  department: string;
  batch_name: string;
  class_name: string;
  learner_count: number;
  completed_count: number;
  completion_percentage: number | null;
};
type TestRow = {
  master_batch_id?: string;
  resource_id: string;
  resource_name: string;
  edmingle_user_id: string;
  name: string;
  registration_number: string | null;
  department: string;
  batch_name: string;
  marks_obtained: number | null;
  total_marks: number | null;
  percentage: number | null;
  position: number | null;
  attempts: number;
};
type SubmissionRow = {
  attempt_id: string; assessment_id: string; assessment_name: string; assessment_type: string;
  learner_name: string; email: string | null; mobile: string | null; evaluated: boolean;
  submission_time: string | null; marks_obtained: number | null; total_marks: number | null; percentage: number | null;
};
type Batch = {
  bundle_id: string;
  bundle_name: string;
  master_batch_id: string;
  batch_name: string;
  department: string;
  admitted_students: number;
};
type Paged<T> = {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
};
type LearnerDetail = {
  student: Student & { email?: string | null; mobile?: string | null };
  topics: Array<{
    topicId: string | null;
    topicName: string;
    assigned: number;
    completed: number;
    incomplete: number;
    completion: number;
    materials: Array<{
      class_id: string;
      resource_id: string;
      resource_name: string;
      resource_type: string;
      activity_kind: string;
      status: string;
      outcome: string;
      attempts: number;
      total_time_seconds: number | null;
    }>;
  }>;
  assessments: Array<{
    resource_id: string;
    resource_name: string;
    marks_obtained: number | null;
    total_marks: number | null;
    percentage: number | null;
    position: number | null;
    attempts: number;
    passed: boolean | null;
    total_time_seconds: number | null;
  }>;
  submissions: Array<{
    attempt_id: string;
    assessment_id: string;
    assessment_name: string;
    assessment_type: string;
    class_id: string;
    course_name: string | null;
    marks_obtained: number | null;
    total_marks: number | null;
    percentage: number | null;
    passed: boolean | null;
    evaluated: boolean;
    submission_time: string | null;
  }>;
};

const demoStudents: Student[] = [
  {
    edmingle_user_id: "92682338",
    name: "Testing 4",
    registration_number: "241909776",
    department: "CSE C",
    batch_name: "MA2C21 · CSE C",
    average_completion: 86,
    verified_completion: 83,
    completed_items: 634,
    content_items: 763,
    latestTest: {
      resource_name: "Internal Quiz 1",
      percentage: 86.67,
      position: 1,
      marks_obtained: 13,
      total_marks: 15,
    },
  },
  {
    edmingle_user_id: "2",
    name: "Sample Learner A",
    registration_number: "241903825",
    department: "EEE",
    batch_name: "MA2324 · EEE",
    average_completion: 74,
    verified_completion: 71,
    completed_items: 541,
    content_items: 763,
    latestTest: {
      resource_name: "Internal Quiz 1",
      percentage: 80,
      position: 3,
      marks_obtained: 12,
      total_marks: 15,
    },
  },
  {
    edmingle_user_id: "3",
    name: "Sample Learner B",
    registration_number: "241905204",
    department: "IT",
    batch_name: "MA2C21 · IT",
    average_completion: 48,
    verified_completion: 45,
    completed_items: 343,
    content_items: 763,
    latestTest: null,
  },
];
const demoContent: ContentRow[] = [
  {
    master_batch_id: "223571",
    class_id: "624810",
    resource_id: "608700",
    resource_name: "1.1 Introduction to Logic and Proofs",
    resource_type: "4",
    department: "CSE A",
    batch_name: "Discrete Mathematics · CSE A",
    class_name: "Unit I - Logic and Proofs",
    learner_count: 63,
    completed_count: 55,
    completion_percentage: 87.3,
  },
  {
    master_batch_id: "223571",
    class_id: "624810",
    resource_id: "608701",
    resource_name: "1.2 Proposition and Connectives",
    resource_type: "4",
    department: "CSE A",
    batch_name: "Discrete Mathematics · CSE A",
    class_name: "Unit I - Logic and Proofs",
    learner_count: 63,
    completed_count: 49,
    completion_percentage: 77.78,
  },
  {
    master_batch_id: "223571",
    class_id: "624810",
    resource_id: "608702",
    resource_name: "Solved Problem 1",
    resource_type: "4",
    department: "CSE A",
    batch_name: "Discrete Mathematics · CSE A",
    class_name: "Unit I - Logic and Proofs",
    learner_count: 63,
    completed_count: 39,
    completion_percentage: 61.9,
  },
];
const demoTests: TestRow[] = [
  {
    resource_id: "734",
    resource_name: "Internal Quiz 1",
    edmingle_user_id: "1",
    name: "Sample Learner C",
    registration_number: "241903901",
    department: "CSE A",
    batch_name: "MA2C21 · CSE A",
    marks_obtained: 15,
    total_marks: 15,
    percentage: 100,
    position: 1,
    attempts: 1,
  },
  {
    resource_id: "734",
    resource_name: "Internal Quiz 1",
    edmingle_user_id: "92682338",
    name: "Testing 4",
    registration_number: "241909776",
    department: "CSE C",
    batch_name: "MA2C21 · CSE C",
    marks_obtained: 13,
    total_marks: 15,
    percentage: 86.67,
    position: 2,
    attempts: 1,
  },
];
const demoSummary: Summary = {
  role: "faculty",
  totalLearners: 1270,
  activeBatches: 20,
  averageContentCompletion: 68.4,
  assessmentAverage: 83.34,
  assessedAttempts: 467,
  needAttention: 143,
  departments: [
    { department: "CSE", completion: 78, learners: 317 },
    { department: "ECE", completion: 73, learners: 251 },
    { department: "EEE", completion: 69, learners: 95 },
    { department: "IT", completion: 64, learners: 174 },
    { department: "MECH", completion: 61, learners: 92 },
  ],
  lastSync: null,
};

const backendUrl = (
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8787"
).replace(/\/$/, "");
const percent = (value: unknown) =>
  Number.isFinite(Number(value)) ? Number(value) : 0;
const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((value) => value[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
const resourceType = (value: string) =>
  value === "4" ? "Video / PDF" : value === "5" ? "Exercise" : `Type ${value}`;
const formatDate = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value))
    : "Not synced yet";

function Bar({ value }: { value: number }) {
  return (
    <div className="bar" aria-label={`${Math.round(value)} percent`}>
      <i style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}
function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="empty">
      <b>No data to display</b>
      <p>{children}</p>
    </div>
  );
}

export default function Portal() {
  const [tab, setTab] = useState<Tab>("overview");
  const [token, setToken] = useState(() =>
    typeof window === "undefined"
      ? ""
      : sessionStorage.getItem("psna_access_token") || "",
  );
  const [demo, setDemo] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("");
  const [batchId, setBatchId] = useState("");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [content, setContent] = useState<ContentRow[]>([]);
  const [tests, setTests] = useState<TestRow[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);
  const [submissionTotal, setSubmissionTotal] = useState(0);
  const [submissionPage, setSubmissionPage] = useState(1);
  const [submissionHasMore, setSubmissionHasMore] = useState(false);
  const [assessmentId, setAssessmentId] = useState("");
  const [batches, setBatches] = useState<Batch[]>([]);
  const [syncRuns, setSyncRuns] = useState<Array<Record<string, unknown>>>([]);
  const [syncRunning, setSyncRunning] = useState(false);
  const [studentPage, setStudentPage] = useState(1);
  const [studentTotal, setStudentTotal] = useState(0);
  const [studentHasMore, setStudentHasMore] = useState(false);
  const [testPage, setTestPage] = useState(1);
  const [testTotal, setTestTotal] = useState(0);
  const [testHasMore, setTestHasMore] = useState(false);
  const [learnerDetail, setLearnerDetail] = useState<LearnerDetail | null>(
    null,
  );
  const [detailLoading, setDetailLoading] = useState(false);
  const [expandedDetail, setExpandedDetail] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [detailRecordLoading, setDetailRecordLoading] = useState(false);

  const api = useCallback(
    async <T,>(
      path: string,
      accessToken = token,
      init?: RequestInit,
    ): Promise<T> => {
      const response = await fetch(`${backendUrl}${path}`, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          ...(init?.headers || {}),
        },
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(
          body.error || body.message || `Request failed (${response.status})`,
        );
      return body as T;
    },
    [token],
  );

  const downloadReport = useCallback(async (path: string, fallbackName: string) => {
    if (demo) return setError("Downloads require live portal sign-in.");
    const response = await fetch(`${backendUrl}${path}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      return setError(body.error || `Download failed (${response.status})`);
    }
    const blob = await response.blob();
    const disposition = response.headers.get("content-disposition") || "";
    const filename = disposition.match(/filename="?([^";]+)"?/i)?.[1] || fallbackName;
    const anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(blob); anchor.download = filename; anchor.click(); URL.revokeObjectURL(anchor.href);
  }, [demo, token]);

  const loadDashboard = useCallback(
    async (accessToken: string) => {
      setLoading(true);
      setError("");
      try {
        const [
          summaryData,
          studentData,
          contentData,
          testData,
          batchData,
          syncData,
        ] = await Promise.all([
          api<Summary>("/api/my-college/summary", accessToken),
          api<Paged<Student>>(
            "/api/my-college/students?page=1&limit=50",
            accessToken,
          ),
          api<Paged<ContentRow>>(
            "/api/my-college/content?limit=100",
            accessToken,
          ),
          api<Paged<TestRow>>("/api/my-college/tests?limit=100", accessToken),
          api<{ data: Batch[] }>("/api/my-college/batches", accessToken),
          api<{ running: boolean; data: Array<Record<string, unknown>> }>(
            "/api/my-college/sync/status",
            accessToken,
          ),
        ]);
        setSummary(summaryData);
        setStudents(studentData.data);
        setStudentPage(1);
        setStudentTotal(studentData.total);
        setStudentHasMore(studentData.hasMore);
        setContent(contentData.data);
      setTests(testData.data); setTestPage(1); setTestTotal(testData.total); setTestHasMore(testData.hasMore);
        setBatches(batchData.data);
        setSyncRuns(syncData.data);
        setSyncRunning(syncData.running);
      } catch (cause) {
        const message =
          cause instanceof Error ? cause.message : "Unable to load analytics";
        setError(message);
        if (/AUTH|SESSION|401/i.test(message)) logout();
      } finally {
        setLoading(false);
      }
    },
    [api],
  );

  useEffect(() => {
    if (!token) return;
    const timer = window.setTimeout(() => void loadDashboard(token), 0);
    return () => window.clearTimeout(timer);
  }, [token, loadDashboard]);

  async function login(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      setError(
        "Portal credentials are not configured. Add the three NEXT_PUBLIC values to portal/.env.local.",
      );
      setLoading(false);
      return;
    }
    try {
      const response = await fetch(`${url}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: { apikey: key, "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const body = await response.json();
      if (!response.ok || !body.access_token)
        throw new Error(
          body.error_description || body.msg || "Unable to sign in",
        );
      sessionStorage.setItem("psna_access_token", body.access_token);
      setToken(body.access_token);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to sign in");
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    sessionStorage.removeItem("psna_access_token");
    setToken("");
    setDemo(false);
    setSummary(null);
    setStudents([]);
    setContent([]);
    setTests([]);
    setBatches([]);
    setPassword("");
  }

  function openDemo() {
    setDemo(true);
    setSummary(demoSummary);
    setStudents(demoStudents);
    setContent(demoContent);
    setTests(demoTests);
    setBatches([
      {
        bundle_id: "75113",
        bundle_name: "Discrete Mathematics",
        master_batch_id: "223571",
        batch_name: "Discrete Mathematics · CSE A",
        department: "CSE A",
        admitted_students: 63,
      },
    ]);
  }

  async function runSync(mode: "roster" | "full") {
    if (!token) return;
    setError("");
    try {
      await api("/api/my-college/sync", token, {
        method: "POST",
        body: JSON.stringify({ mode }),
      });
      setSyncRunning(true);
      setTimeout(() => void loadDashboard(token), 5000);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to start sync");
    }
  }

  async function loadStudentPage(page: number) {
    if (demo) return;
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ page: String(page), limit: "50" });
      if (search) params.set("search", search);
      if (department) params.set("department", department);
      if (batchId) params.set("master_batch_id", batchId);
      const result = await api<Paged<Student>>(
        `/api/my-college/students?${params}`,
      );
      setStudents(result.data);
      setStudentPage(result.page);
      setStudentTotal(result.total);
      setStudentHasMore(result.hasMore);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to load learners",
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadTestPage(page: number) {
    if (demo) return;
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams({ page: String(page), limit: "100" });
      if (search) params.set("search", search);
      if (department) params.set("department", department);
      if (batchId) params.set("master_batch_id", batchId);
      const result = await api<Paged<TestRow>>(`/api/my-college/tests?${params}`);
      setTests(result.data); setTestPage(result.page); setTestTotal(result.total); setTestHasMore(result.hasMore);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load test results"); }
    finally { setLoading(false); }
  }

  async function loadSubmissionPage(page: number) {
    if (demo) return;
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams({ page: String(page), limit: "100" });
      if (search) params.set("search", search);
      if (batchId) params.set("master_batch_id", batchId);
      const result = await api<Paged<SubmissionRow>>(`/api/my-college/submissions?${params}`);
      setSubmissions(result.data); setSubmissionPage(result.page); setSubmissionTotal(result.total); setSubmissionHasMore(result.hasMore);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load submissions"); }
    finally { setLoading(false); }
  }

  async function openLearner(studentId: string) {
    if (demo) return;
    setDetailLoading(true);
    setError("");
    try {
      setLearnerDetail(
        await api<LearnerDetail>(
          `/api/my-college/students/${studentId}/details`,
        ),
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to load learner details",
      );
    } finally {
      setDetailLoading(false);
    }
  }

  async function loadAttempt(attemptId: string) {
    if (!learnerDetail) return;
    setDetailRecordLoading(true);
    try {
      setExpandedDetail(
        await api<Record<string, unknown>>(
          `/api/my-college/students/${learnerDetail.student.edmingle_user_id}/attempts/${attemptId}/details`,
        ),
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to load attempt details",
      );
    } finally {
      setDetailRecordLoading(false);
    }
  }

  async function loadViews(material: {
    class_id: string;
    resource_id: string;
  }) {
    if (!learnerDetail) return;
    setDetailRecordLoading(true);
    try {
      setExpandedDetail(
        await api<Record<string, unknown>>(
          `/api/my-college/students/${learnerDetail.student.edmingle_user_id}/materials/${material.resource_id}/views?class_id=${material.class_id}`,
        ),
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to load view history",
      );
    } finally {
      setDetailRecordLoading(false);
    }
  }

  useEffect(() => {
    if (!token || tab !== "progress") return;
    const timer = window.setTimeout(() => void loadStudentPage(1), 300);
    return () => window.clearTimeout(timer);
  }, [search, department, batchId, tab]);

  useEffect(() => {
    if (!token || tab !== "submissions") return;
    const timer = window.setTimeout(() => void loadSubmissionPage(1), 300);
    return () => window.clearTimeout(timer);
  }, [search, batchId, tab]);

  useEffect(() => {
    if (!token || tab !== "tests") return;
    const timer = window.setTimeout(() => void loadTestPage(1), 300);
    return () => window.clearTimeout(timer);
  }, [search, department, batchId, tab]);

  const departments = useMemo(
    () =>
      [
        ...new Set(batches.map((batch) => batch.department).filter(Boolean)),
      ].sort(),
    [batches],
  );
  const filteredStudents = students.filter(
    (student) =>
      (!search ||
        `${student.name} ${student.registration_number || ""}`
          .toLowerCase()
          .includes(search.toLowerCase())) &&
      (!department || student.department?.includes(department)) &&
      (!batchId || student.master_batch_ids?.split(", ").includes(batchId)),
  );
  const filteredContent = content.filter(
    (row) =>
      (!search ||
        row.resource_name.toLowerCase().includes(search.toLowerCase())) &&
      (!department || row.department === department) &&
      (!batchId || row.master_batch_id === batchId),
  );
  const filteredTests = tests.filter(
    (row) =>
      (!search ||
        `${row.name} ${row.registration_number || ""}`
          .toLowerCase()
          .includes(search.toLowerCase())) &&
      (!department || row.department === department) &&
      (!batchId || row.master_batch_id === batchId),
  );
  const inside = Boolean(token || demo);
  const titles: Record<Tab, string> = {
    overview: "Learning overview",
    progress: "Learner progress",
    tests: "Online test results",
    submissions: "Quiz submissions",
    students: "Students",
    sync: "Sync & security",
  };

  if (!inside)
    return (
      <main className="login">
        <section className="brand">
          <div className="mark">ME</div>
          <div>
            <p className="eyebrow">MATHS.ENGINEERING</p>
            <h1>
              See every learner.
              <br />
              Support every outcome.
            </h1>
            <p>
              A secure faculty dashboard for PSNA content completion and online
              assessment performance.
            </p>
          </div>
          <aside>
            <b>✓</b>
            <span>
              <strong>Batch-isolated access</strong>
              <small>
                Only the 20 approved PSNA master batches are synchronized.
              </small>
            </span>
          </aside>
        </section>
        <section className="signin">
          <form onSubmit={login}>
            <p className="eyebrow">PSNA FACULTY ANALYTICS</p>
            <h2>Welcome back</h2>
            <p>Use your existing approved Supabase faculty account.</p>
            <label>
              Email address
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="faculty email"
                autoComplete="email"
                required
              />
            </label>
            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
                autoComplete="current-password"
                required
              />
            </label>
            {error && (
              <div className="error" role="alert">
                {error}
              </div>
            )}
            <button className="primary" disabled={loading}>
              {loading ? "Signing in…" : "Sign in securely"}
            </button>
            <div className="or">or review the completed interface</div>
            <button type="button" className="demo" onClick={openDemo}>
              Explore demo portal
            </button>
            <small>
              Edmingle and service-role keys never enter the browser.
            </small>
          </form>
        </section>
      </main>
    );

  return (
    <main className="shell">
      <aside className="nav">
        <div className="navlogo">
          <div className="mark mini">ME</div>
          <span>
            <strong>Maths.Engineering</strong>
            <small>Faculty Analytics</small>
          </span>
        </div>
        <div className="college">
          <b>PS</b>
          <span>
            <strong>PSNA College</strong>
            <small>Engineering & Technology</small>
          </span>
        </div>
        <nav aria-label="Portal sections">
          {(
            [
              ["overview", "⌂", "Overview"],
              ["progress", "◫", "Learner Progress"],
              ["tests", "✓", "Online Tests"],
              ["submissions", "▤", "Quiz Submissions"],
              ["sync", "↻", "Sync & Security"],
            ] as Array<[Tab, string, string]>
          ).map(([id, icon, label]) => (
            <button
              key={id}
              className={tab === id ? "active" : ""}
              onClick={() => {
                setTab(id);
                setSearch("");
              }}
            >
              <i>{icon}</i>
              {label}
            </button>
          ))}
        </nav>
        <footer>
          <i>PF</i>
          <span>
            <strong>PSNA Faculty</strong>
            <small>{demo ? "Demo access" : email || summary?.role}</small>
          </span>
          <button onClick={logout} aria-label="Sign out">
            ↪
          </button>
        </footer>
      </aside>
      <section className="workspace">
        <header>
          <div>
            <p className="eyebrow">PSNA FACULTY PORTAL</p>
            <h1>{titles[tab]}</h1>
          </div>
          <span className={loading ? "available loading" : "available"}>
            ●{" "}
            {loading
              ? "Refreshing"
              : syncRunning
                ? "Sync running"
                : "Data available"}
          </span>
        </header>
        {demo && (
          <div className="demobar">
            <b>Demo mode</b> Illustrative records are shown. Sign in after
            configuration for live PSNA data.
          </div>
        )}
        {error && (
          <div className="globalerror" role="alert">
            {error}
            <button onClick={() => setError("")}>×</button>
          </div>
        )}
        {tab === "overview" && summary && (
          <div className="content">
            <div className="welcome">
              <span>
                <h2>PSNA learning snapshot</h2>
                <p>
                  Only students enrolled in the approved PSNA batches are
                  included.
                </p>
              </span>
              <button onClick={() => token && loadDashboard(token)}>
                ↻ {formatDate(summary.lastSync?.completed_at)}
              </button>
            </div>
            <div className="metrics">
              {[
                [
                  "♙",
                  "Total learners",
                  summary.totalLearners,
                  `${summary.activeBatches} approved batches`,
                ],
                [
                  "◔",
                  "Avg. completion",
                  `${percent(summary.averageContentCompletion).toFixed(1)}%`,
                  "Video and PDF progress",
                ],
                [
                  "✓",
                  "Assessment average",
                  `${percent(summary.assessmentAverage).toFixed(1)}%`,
                  `${summary.assessedAttempts} attempts`,
                ],
                [
                  "!",
                  "Need attention",
                  summary.needAttention,
                  "Below 50% completion",
                ],
              ].map((item, index) => (
                <article key={String(item[1])}>
                  <i className={`m${index}`}>{item[0]}</i>
                  <span>
                    <small>{item[1]}</small>
                    <strong>{item[2]}</strong>
                    <em>{item[3]}</em>
                  </span>
                </article>
              ))}
            </div>
            <div className="twocol">
              <article className="card">
                <div className="cardhead">
                  <span>
                    <h3>Department completion</h3>
                    <p>Verified material completion by department</p>
                  </span>
                  <button onClick={() => setTab("progress")}>
                    View details →
                  </button>
                </div>
                {summary.departments.slice(0, 8).map((row) => (
                  <div className="barrow" key={row.department}>
                    <b>{row.department}</b>
                    <Bar value={percent(row.completion)} />
                    <strong>{percent(row.completion).toFixed(0)}%</strong>
                  </div>
                ))}
              </article>
              <article className="card">
                <div className="cardhead">
                  <span>
                    <h3>Learners needing attention</h3>
                    <p>Lowest completion in the loaded page</p>
                  </span>
                  <b className="badge">{summary.needAttention}</b>
                </div>
                {students
                  .filter(
                    (student) =>
                      percent(
                        student.verified_completion ??
                          student.average_completion,
                      ) < 50,
                  )
                  .slice(0, 6)
                  .map((student) => (
                    <div className="minirow" key={student.edmingle_user_id}>
                      <i>{initials(student.name)}</i>
                      <span>
                        <strong>{student.name}</strong>
                        <small>
                          {student.department} ·{" "}
                          {student.registration_number || "No register number"}
                        </small>
                      </span>
                      <b>
                        {percent(
                          student.verified_completion ??
                            student.average_completion,
                        ).toFixed(0)}
                        %
                      </b>
                    </div>
                  ))}
              </article>
            </div>
            <article className="card">
              <div className="cardhead">
                <span>
                  <h3>Recent assessment leaders</h3>
                  <p>
                    Competition rank preserves equal positions for equal scores.
                  </p>
                </span>
                <button onClick={() => setTab("tests")}>Full ranking →</button>
              </div>
              <Ranking rows={tests.slice(0, 5)} />
            </article>
          </div>
        )}
        {tab === "progress" && (
          <div className="content">
            <Filters
              search={search}
              setSearch={setSearch}
              department={department}
              setDepartment={setDepartment}
              batchId={batchId}
              setBatchId={setBatchId}
              departments={departments}
              batches={batches}
              exportLabel="Export topic-wise progress"
              exportRows={() => {
                if (!batchId) {
                  setError("Select one batch before exporting. The report will contain one column for every topic, material and quiz assigned to that batch.");
                  return;
                }
                void downloadReport(`/api/my-college/exports/content-progress?master_batch_id=${batchId}`, `PSNA-Content-Progress-Report-${batchId}.csv`);
              }}
            />
            <article className="card">
              <div className="cardhead">
                <span>
                  <h3>Learner progress</h3>
                  <p>
                    Every assigned material and assessment, organized by
                    student.
                  </p>
                </span>
                <b className="info">
                  {studentTotal || students.length} learners
                </b>
              </div>
              {students.length ? (
                <div className="table learnerprogress">
                  <div className="thead">
                    <b>Learner</b>
                    <b>Materials</b>
                    <b>Completion</b>
                    <b>Assessments</b>
                    <b>Status</b>
                    <b></b>
                  </div>
                  {students.map((student) => {
                    const completion = percent(
                      student.verified_completion ?? student.average_completion,
                    );
                    return (
                      <div className="trow" key={student.edmingle_user_id}>
                        <span className="person">
                          <i>{initials(student.name)}</i>
                          <em>
                            <strong>{student.name}</strong>
                            <small>
                              {student.registration_number ||
                                student.edmingle_user_id}{" "}
                              · {student.department}
                            </small>
                          </em>
                        </span>
                        <span>
                          <strong>
                            {student.completed_items || 0} completed
                          </strong>
                          <small>
                            {student.incomplete_items || 0} incomplete ·{" "}
                            {student.content_items || 0} assigned
                          </small>
                        </span>
                        <span className="inlinebar">
                          <Bar value={completion} />
                          <small>{completion.toFixed(1)}%</small>
                        </span>
                        <span>
                          <strong>
                            {student.assessments_attempted || 0}/
                            {student.assessments_assigned || 0} attempted
                          </strong>
                          <small>
                            {student.assessment_average == null
                              ? "No score"
                              : `${percent(student.assessment_average).toFixed(1)}% average`}
                          </small>
                        </span>
                        <span
                          className={`learnerstatus ${completion >= 100 ? "done" : completion < 50 ? "risk" : "active"}`}
                        >
                          {completion >= 100
                            ? "Completed"
                            : completion < 50
                              ? "Needs attention"
                              : "In progress"}
                        </span>
                        <button
                          className="detailsbtn"
                          disabled={detailLoading}
                          onClick={() =>
                            void openLearner(student.edmingle_user_id)
                          }
                        >
                          View details
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <Empty>No learner matches the selected filters.</Empty>
              )}
              <div className="pager">
                <span>
                  Page {studentPage} · {studentTotal} learners
                </span>
                <button
                  disabled={studentPage <= 1 || loading}
                  onClick={() => void loadStudentPage(studentPage - 1)}
                >
                  ← Previous
                </button>
                <button
                  disabled={!studentHasMore || loading}
                  onClick={() => void loadStudentPage(studentPage + 1)}
                >
                  Next →
                </button>
              </div>
            </article>
          </div>
        )}
        {tab === "tests" && (
          <div className="content">
            <div className="metrics compact">
              {[
                ["Students attempted", summary?.uniqueAssessedLearners ?? 0],
                [
                  "Average percentage",
                  `${percent(summary?.assessmentAverage).toFixed(1)}%`,
                ],
                [
                  "Highest percentage",
                  `${percent(summary?.highestAssessmentPercentage).toFixed(1)}%`,
                ],
                [
                  "Assessments",
                  summary?.assessmentCount ?? 0,
                ],
              ].map((item) => (
                <article key={String(item[0])}>
                  <span>
                    <small>{item[0]}</small>
                    <strong>{item[1]}</strong>
                  </span>
                </article>
              ))}
            </div>
            <Filters
              search={search}
              setSearch={setSearch}
              department={department}
              setDepartment={setDepartment}
              batchId={batchId}
              setBatchId={setBatchId}
              departments={departments}
              batches={batches}
              exportLabel="Export all test results"
              exportRows={() => {
                const params = new URLSearchParams();
                if (search) params.set("search", search);
                if (department) params.set("department", department);
                if (batchId) params.set("master_batch_id", batchId);
                void downloadReport(`/api/my-college/exports/test-results?${params}`, "psna-online-test-results.csv");
              }}
            />
            <article className="card">
              <div className="cardhead">
                <span>
                  <h3>Assessment ranking</h3>
                  <p>
                    Position is calculated within each Edmingle assessment;
                    equal percentages share a position.
                  </p>
                </span>
                <b className="success">Evaluated</b>
                <select value={assessmentId} onChange={(event) => setAssessmentId(event.target.value)} aria-label="Assessment for attempt report">
                  <option value="">Choose assessment</option>
                  {[...new Map(tests.map(row => [row.resource_id, row.resource_name])).entries()].map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                </select>
                <button disabled={!assessmentId} onClick={() => void downloadReport(`/api/my-college/exports/attempt-report?resource_id=${assessmentId}`, `psna-attempt-report-${assessmentId}.csv`)}>Download attempt report</button>
              </div>
              {filteredTests.length ? (
                <Ranking rows={filteredTests} />
              ) : (
                <Empty>No attempted online tests match these filters.</Empty>
              )}
              <div className="pager">
                <span>Page {testPage} · {testTotal} attempted result rows</span>
                <button disabled={testPage <= 1 || loading} onClick={() => void loadTestPage(testPage - 1)}>← Previous</button>
                <button disabled={!testHasMore || loading} onClick={() => void loadTestPage(testPage + 1)}>Next →</button>
              </div>
            </article>
          </div>
        )}
        {tab === "submissions" && (
          <div className="content">
            <Filters search={search} setSearch={setSearch} department="" setDepartment={() => {}} batchId={batchId} setBatchId={setBatchId} departments={[]} batches={batches} exportLabel="Export all submissions" exportRows={() => void downloadReport(`/api/my-college/exports/quiz-submissions${batchId ? `?master_batch_id=${batchId}` : ""}`, "psna-quiz-submissions.csv")} />
            <article className="card">
              <div className="cardhead"><span><h3>Quiz submissions</h3><p>Every Edmingle submission with evaluation, contact, date and marks.</p></span><b className="info">{submissionTotal} submissions</b></div>
              {submissions.length ? <div className="table submissions">
                <div className="thead"><b>Learner</b><b>Assessment</b><b>Submitted</b><b>Evaluation</b><b>Marks</b><b>Percentage</b></div>
                {submissions.map(row => <div className="trow" key={row.attempt_id}>
                  <span className="person"><i>{initials(row.learner_name)}</i><em><strong>{row.learner_name}</strong><small>{row.email || row.mobile || "Contact unavailable"}</small></em></span>
                  <span><strong>{row.assessment_name}</strong><small>{row.assessment_type}</small></span>
                  <span>{row.submission_time ? formatDate(row.submission_time) : "—"}</span>
                  <span className={row.evaluated ? "success" : "info"}>{row.evaluated ? "EVALUATED" : "PENDING"}</span>
                  <strong>{row.marks_obtained ?? "—"} / {row.total_marks ?? "—"}</strong>
                  <b className="score">{row.percentage == null ? "—" : `${Number(row.percentage).toFixed(2)}%`}</b>
                </div>)}
              </div> : <Empty>No submission rows are stored yet. Open Sync &amp; Security and run Full Analytics Sync after applying the detailed analytics migration.</Empty>}
              <div className="pager"><span>Page {submissionPage} · {submissionTotal} submissions</span><button disabled={submissionPage <= 1 || loading} onClick={() => void loadSubmissionPage(submissionPage - 1)}>← Previous</button><button disabled={!submissionHasMore || loading} onClick={() => void loadSubmissionPage(submissionPage + 1)}>Next →</button></div>
            </article>
          </div>
        )}
        {tab === "students" && (
          <div className="content">
            <Filters
              search={search}
              setSearch={setSearch}
              department={department}
              setDepartment={setDepartment}
              batchId={batchId}
              setBatchId={setBatchId}
              departments={departments}
              batches={batches}
            />
            <article className="card">
              <div className="cardhead">
                <span>
                  <h3>PSNA learners</h3>
                  <p>
                    {filteredStudents.length} learners loaded from approved
                    batches
                  </p>
                </span>
              </div>
              {filteredStudents.length ? (
                <div className="table learners">
                  <div className="thead">
                    <b>Learner</b>
                    <b>Batch</b>
                    <b>Content completion</b>
                    <b>Latest test</b>
                    <b>Position</b>
                  </div>
                  {filteredStudents.map((student) => {
                    const completion = percent(
                      student.verified_completion ?? student.average_completion,
                    );
                    return (
                      <div className="trow" key={student.edmingle_user_id}>
                        <span className="person">
                          <i>{initials(student.name)}</i>
                          <em>
                            <strong>{student.name}</strong>
                            <small>
                              {student.registration_number ||
                                student.edmingle_user_id}{" "}
                              · {student.department}
                            </small>
                          </em>
                        </span>
                        <span>{student.batch_name || "Batch unavailable"}</span>
                        <span className="inlinebar">
                          <Bar value={completion} />
                          <small>
                            {completion.toFixed(1)}% ·{" "}
                            {student.completed_items || 0}/
                            {student.content_items || 0}
                          </small>
                        </span>
                        <strong>
                          {student.latestTest?.percentage == null
                            ? "—"
                            : `${percent(student.latestTest.percentage).toFixed(1)}%`}
                        </strong>
                        <b className="score">
                          {student.latestTest?.position
                            ? `#${student.latestTest.position}`
                            : "—"}
                        </b>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <Empty>No learner matches the selected filters.</Empty>
              )}
            </article>
          </div>
        )}
        {tab === "sync" && (
          <div className="content narrow">
            <article className="secure">
              <b>✓</b>
              <span>
                <h2>PSNA data boundary is active</h2>
                <p>
                  Organization 5173 plus an explicit 20-batch allowlist protects
                  the Edmingle source. Supabase RLS then checks the teacher’s
                  existing profile college.
                </p>
              </span>
            </article>
            <div className="twocol">
              <article className="card">
                <h3>Connection status</h3>
                {[
                  ["Supabase authentication", token ? "Authenticated" : "Demo"],
                  ["Existing profiles.college_id", "Enforced"],
                  ["Edmingle API headers", "Server only"],
                  ["Approved organization", "5173"],
                ].map((item) => (
                  <div className="setting" key={item[0]}>
                    <span>{item[0]}</span>
                    <b>{item[1]}</b>
                  </div>
                ))}
              </article>
              <article className="card">
                <h3>Approved data scope</h3>
                {[
                  ["Courses", "75069, 75072, 75113"],
                  ["Master batches", "20 approved"],
                  ["Student source", "masterbatch/{id}/students"],
                  ["Analytics", "materials + submissions + attempts"],
                ].map((item) => (
                  <div className="setting" key={item[0]}>
                    <span>{item[0]}</span>
                    <code>{item[1]}</code>
                  </div>
                ))}
              </article>
            </div>
            <article className="card">
              <div className="cardhead">
                <span>
                  <h3>Refresh PSNA analytics</h3>
                  <p>
                    Roster sync is faster. Full sync retrieves per-resource
                    completion, test rankings and full submission history and can take time.
                  </p>
                </span>
                {!demo &&
                  ["hod", "super_admin", "college_admin"].includes(
                    summary?.role || "",
                  ) && (
                    <span className="syncactions">
                      <button
                        className="secondary"
                        disabled={syncRunning}
                        onClick={() => runSync("roster")}
                      >
                        Sync roster
                      </button>
                      <button
                        className="syncbtn"
                        disabled={syncRunning}
                        onClick={() => runSync("full")}
                      >
                        {syncRunning ? "Sync running…" : "Run full sync"}
                      </button>
                    </span>
                  )}
              </div>
              <div className="callout">
                <b>Rate-limit protection</b>
                <p>
                  Calls are spaced at least 3.1 seconds apart, below Edmingle’s
                  30 calls-per-minute limit. The status below updates after
                  refresh.
                </p>
              </div>
              {syncRuns.length > 0 && (
                <div className="runs">
                  {syncRuns.slice(0, 5).map((run, index) => (
                    <div className="setting" key={String(run.id || index)}>
                      <span>
                        <strong>
                          {String(run.sync_mode)} sync · {String(run.status)}
                        </strong>
                        <small>
                          {formatDate(String(run.started_at || ""))}
                        </small>
                      </span>
                      <code>
                        {String(run.students_synced || 0)} student rows ·{" "}
                        {String(run.content_rows_synced || 0)} content rows · {String(run.submissions_synced || 0)} submissions
                      </code>
                    </div>
                  ))}
                </div>
              )}
            </article>
          </div>
        )}
        {learnerDetail && (
          <div
            className="modalback"
            role="presentation"
            onClick={() => {
              setLearnerDetail(null);
              setExpandedDetail(null);
            }}
          >
            <section
              className="detailpanel"
              role="dialog"
              aria-modal="true"
              aria-label="Learner details"
              onClick={(event) => event.stopPropagation()}
            >
              <header>
                <span>
                  <h2>{learnerDetail.student.name}</h2>
                  <p>
                    {learnerDetail.student.registration_number ||
                      learnerDetail.student.edmingle_user_id}{" "}
                    · {learnerDetail.student.department}
                  </p>
                  <small>
                    {learnerDetail.student.email || "No email"} ·{" "}
                    {learnerDetail.student.mobile || "No contact number"}
                  </small>
                </span>
                <button
                  onClick={() => {
                    setLearnerDetail(null);
                    setExpandedDetail(null);
                  }}
                  aria-label="Close"
                >
                  ×
                </button>
              </header>
              <div className="detailmetrics">
                <b>
                  {learnerDetail.student.completed_items || 0}
                  <small>Materials completed</small>
                </b>
                <b>
                  {learnerDetail.student.incomplete_items || 0}
                  <small>Materials incomplete</small>
                </b>
                <b>
                  {percent(learnerDetail.student.verified_completion).toFixed(
                    1,
                  )}
                  %<small>Overall completion</small>
                </b>
                <b>
                  {learnerDetail.student.assessment_average == null
                    ? "—"
                    : `${percent(learnerDetail.student.assessment_average).toFixed(1)}%`}
                  <small>Assessment average</small>
                </b>
              </div>
              <h3>Topics and assigned materials</h3>
              {learnerDetail.topics.map((topic) => (
                <details
                  className="topic"
                  key={topic.topicId || topic.topicName}
                >
                  <summary>
                    <span>
                      <strong>{topic.topicName}</strong>
                      <small>
                        {topic.completed}/{topic.assigned} completed
                      </small>
                    </span>
                    <b>{topic.completion.toFixed(1)}%</b>
                  </summary>
                  {topic.materials.map((material) => (
                    <div
                      className="material"
                      key={`${material.class_id}-${material.resource_id}`}
                    >
                      <span>
                        <strong>{material.resource_name}</strong>
                        <small>
                          {resourceType(material.resource_type)} ·{" "}
                          {material.attempts} record(s)
                          {material.total_time_seconds == null
                            ? ""
                            : ` · ${material.total_time_seconds}s`}
                        </small>
                      </span>
                      <span className="rowactions">
                        <b
                          className={`learnerstatus ${["completed", "passed"].includes(material.outcome) ? "done" : material.outcome === "not_attempted" ? "risk" : "active"}`}
                        >
                          {material.outcome.replaceAll("_", " ")}
                        </b>
                        <button
                          onClick={() => void loadViews(material)}
                          disabled={detailRecordLoading}
                        >
                          View history
                        </button>
                      </span>
                    </div>
                  ))}
                </details>
              ))}
              <h3>Submission history</h3>
              {learnerDetail.submissions.length ? (
                <div className="assessmentlist">
                  {learnerDetail.submissions.map((item) => (
                    <div className="material" key={item.attempt_id}>
                      <span>
                        <strong>{item.assessment_name}</strong>
                        <small>
                          {formatDate(item.submission_time)} ·{" "}
                          {item.evaluated ? "Evaluated" : "Pending evaluation"}{" "}
                          · Attempt {item.attempt_id}
                        </small>
                        <small>
                          {item.marks_obtained ?? "—"}/{item.total_marks ?? "—"}{" "}
                          marks ·{" "}
                          {item.passed === null
                            ? "Status unavailable"
                            : item.passed
                              ? "Passed"
                              : "Not passed"}
                        </small>
                      </span>
                      <span className="rowactions">
                        <b>
                          {item.percentage == null
                            ? "—"
                            : `${percent(item.percentage).toFixed(1)}%`}
                        </b>
                        <button
                          onClick={() => void loadAttempt(item.attempt_id)}
                          disabled={detailRecordLoading}
                        >
                          Part details
                        </button>
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <Empty>
                  No submission history is available for this learner.
                </Empty>
              )}
              {expandedDetail && (
                <div className="rawdetail">
                  <div>
                    <h3>Edmingle detail</h3>
                    <button onClick={() => setExpandedDetail(null)}>×</button>
                  </div>
                  <pre>{JSON.stringify(expandedDetail, null, 2)}</pre>
                </div>
              )}
              <h3>Assessment summary and rank</h3>
              {learnerDetail.assessments.length ? (
                <div className="assessmentlist">
                  {learnerDetail.assessments.map((item) => (
                    <div className="material" key={item.resource_id}>
                      <span>
                        <strong>{item.resource_name}</strong>
                        <small>
                          {item.attempts} attempt(s) ·{" "}
                          {item.marks_obtained ?? "—"}/{item.total_marks ?? "—"}{" "}
                          marks
                        </small>
                      </span>
                      <b>
                        {item.percentage == null
                          ? "—"
                          : `${percent(item.percentage).toFixed(1)}%`}
                        {item.position ? ` · Rank #${item.position}` : ""}
                      </b>
                    </div>
                  ))}
                </div>
              ) : (
                <Empty>
                  No assessment summary is available for this learner.
                </Empty>
              )}
            </section>
          </div>
        )}
      </section>
    </main>
  );
}

function Filters({
  search,
  setSearch,
  department,
  setDepartment,
  batchId,
  setBatchId,
  departments,
  batches,
  exportRows,
  exportLabel = "Export CSV",
}: {
  search: string;
  setSearch: (value: string) => void;
  department: string;
  setDepartment: (value: string) => void;
  batchId: string;
  setBatchId: (value: string) => void;
  departments: string[];
  batches: Batch[];
  exportRows?: () => void;
  exportLabel?: string;
}) {
  return (
    <div className="filters">
      <input
        className="grow"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search learner or resource"
        aria-label="Search"
      />
      <select
        value={department}
        onChange={(event) => setDepartment(event.target.value)}
        aria-label="Department"
      >
        <option value="">All departments</option>
        {departments.map((value) => (
          <option key={value}>{value}</option>
        ))}
      </select>
      <select
        value={batchId}
        onChange={(event) => setBatchId(event.target.value)}
        aria-label="Batch"
      >
        <option value="">All batches</option>
        {batches.map((batch) => (
          <option key={batch.master_batch_id} value={batch.master_batch_id}>
            {batch.department} · {batch.master_batch_id}
          </option>
        ))}
      </select>
      {exportRows && <button onClick={exportRows}>{exportLabel}</button>}
    </div>
  );
}

function Ranking({ rows }: { rows: TestRow[] }) {
  return (
    <div className="table ranking">
      <div className="thead">
        <b>Position</b>
        <b>Learner</b>
        <b>Department</b>
        <b>Marks</b>
        <b>Percentage</b>
      </div>
      {rows.map((row, index) => (
        <div
          className="trow"
          key={`${row.resource_id}-${row.edmingle_user_id}-${index}`}
        >
          <span className={`place p${row.position || 0}`}>
            {row.position || "—"}
          </span>
          <span className="person">
            <i>{initials(row.name)}</i>
            <em>
              <strong>{row.name}</strong>
              <small>
                {row.registration_number || row.edmingle_user_id} ·{" "}
                {row.resource_name}
              </small>
            </em>
          </span>
          <span>{row.department}</span>
          <strong>
            {row.marks_obtained == null
              ? "—"
              : `${row.marks_obtained} / ${row.total_marks ?? "—"}`}
          </strong>
          <span className="score">
            {row.percentage == null
              ? "—"
              : `${percent(row.percentage).toFixed(2)}%`}
          </span>
        </div>
      ))}
    </div>
  );
}

function exportTests(rows: TestRow[]) {
  const columns = [
    "Position",
    "Learner",
    "Registration Number",
    "Department",
    "Batch",
    "Assessment",
    "Marks",
    "Total Marks",
    "Percentage",
  ];
  const escape = (value: unknown) =>
    `"${String(value ?? "").replaceAll('"', '""')}"`;
  const csv = [
    columns,
    ...rows.map((row) => [
      row.position,
      row.name,
      row.registration_number,
      row.department,
      row.batch_name,
      row.resource_name,
      row.marks_obtained,
      row.total_marks,
      row.percentage,
    ]),
  ]
    .map((row) => row.map(escape).join(","))
    .join("\r\n");
  const anchor = document.createElement("a");
  anchor.href = URL.createObjectURL(
    new Blob([csv], { type: "text/csv;charset=utf-8" }),
  );
  anchor.download = `psna-online-test-results-${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(anchor.href);
}
