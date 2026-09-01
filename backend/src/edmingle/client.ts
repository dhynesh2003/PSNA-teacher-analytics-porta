import { config } from "../config.js";

let lastCallAt = 0;

async function throttle() {
  const wait = Math.max(0, lastCallAt + config.EDMINGLE_MIN_GAP_MS - Date.now());
  if (wait) await new Promise(resolve => setTimeout(resolve, wait));
  lastCallAt = Date.now();
}

function interpolate(path: string, values: Record<string, string>) {
  return path.replace(/\{([^}]+)\}/g, (_, key) => encodeURIComponent(values[key] ?? ""));
}

type EdmingleErrorBody = { code?: number; message?: string };

export class EdmingleError extends Error {
  constructor(public readonly status: number, public readonly apiCode: number | undefined, message: string) {
    super(`EDMINGLE_HTTP_${status}: ${message}`);
    this.name = "EdmingleError";
  }
}

export async function edmingleGet(
  path: string,
  values: Record<string, string> = {},
  includeOrganization = true
) {
  const url = new URL(
    interpolate(path, values),
    config.EDMINGLE_BASE_URL.endsWith("/")
      ? config.EDMINGLE_BASE_URL
      : `${config.EDMINGLE_BASE_URL}/`
  );

  const headers: Record<string, string> = {
    apikey: config.EDMINGLE_API_KEY,
    Accept: "application/json"
  };

  if (includeOrganization && config.EDMINGLE_PSNA_ORG_ID) {
    headers.ORGID = config.EDMINGLE_PSNA_ORG_ID;
  }

  const maxAttempts = 5;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await throttle();

      const response = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(120_000)
      });

      const body = await response
        .json()
        .catch(() => null) as EdmingleErrorBody | null;

      if (response.ok) {
        return body;
      }

      const retryable =
        response.status === 429 ||
        response.status === 502 ||
        response.status === 503 ||
        response.status === 504;

      if (!retryable || attempt === maxAttempts) {
        if (response.status === 429) {
          throw new EdmingleError(
            429,
            body?.code,
            "rate limited; Edmingle may temporarily block this endpoint"
          );
        }

        throw new EdmingleError(
          response.status,
          body?.code,
          body?.message ?? "Unknown Edmingle error"
        );
      }

      const delayMs = attempt * 15_000;

      console.warn(
        `Edmingle HTTP ${response.status}. ` +
        `Retrying ${attempt}/${maxAttempts} in ${delayMs / 1000}s`
      );

      await new Promise(resolve => setTimeout(resolve, delayMs));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);

      const causeCode =
        error &&
        typeof error === "object" &&
        "cause" in error &&
        error.cause &&
        typeof error.cause === "object" &&
        "code" in error.cause
          ? String(error.cause.code)
          : "";

      const retryableNetworkError =
        message.includes("fetch failed") ||
        message.includes("timeout") ||
        message.includes("aborted") ||
        causeCode === "ECONNRESET" ||
        causeCode === "ETIMEDOUT" ||
        causeCode === "ECONNREFUSED" ||
        causeCode === "EAI_AGAIN";

      if (!retryableNetworkError || attempt === maxAttempts) {
        throw error;
      }

      const delayMs = attempt * 15_000;

      console.warn(
        `Edmingle network error ${causeCode || message}. ` +
        `Retrying ${attempt}/${maxAttempts} in ${delayMs / 1000}s`
      );

      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  throw new Error("Edmingle request failed after all retry attempts");
}

export function getOrganizations() {
  return edmingleGet(config.EDMINGLE_ORGANIZATIONS_PATH, { institutionId: config.EDMINGLE_INSTITUTION_ID }, false);
}

export function searchStudentByEmail(email: string) {
  return edmingleGet(
    `student/search?institution_id={institutionId}&student_email={email}`,
    { institutionId: config.EDMINGLE_INSTITUTION_ID, email },
    false
  );
}

export const listStudents = (page = "1", perPage = "100") => edmingleGet(`organization/students?organization_id={orgId}&search=&is_archived=0&page={page}&per_page={perPage}`, { orgId: config.EDMINGLE_PSNA_ORG_ID, page, perPage });
export const listBatches = (bundleId: string) => edmingleGet(`short/masterbatch?status=0&page=1&per_page=100&organization_id={orgId}&bundle_id={bundleId}`, { orgId: config.EDMINGLE_PSNA_ORG_ID, bundleId });
export const getBatchStudents = (batchId: string, classId: string, page = "1", perPage = "100") => edmingleGet(`masterbatch/{batchId}/students?sort_order=D&sort_by=progress&class_id={classId}&page={page}&per_page={perPage}`, { batchId, classId, page, perPage });
export const getMaterialProgress = (classId: string, page = "1", perPage = "100") => edmingleGet(`report/class/progress?class_id={classId}&page={page}&per_page={perPage}&material_required=1`, { classId, page, perPage });
export const getExerciseProgress = (classId: string, page = "1", perPage = "100") => edmingleGet(`reports/classprogress?class_id={classId}&page={page}&per_page={perPage}`, { classId, page, perPage });
export const getSubmissions = (start: string, end: string, page = "1") => edmingleGet(`submissions?page={page}&per_page=100&search=&sort_order=D&sort_by=submission_time&start_date={start}&end_date={end}&evaluated=-1`, { page, start, end });
export const getResourceStats = (resourceId: string, resourceType: string, classId: string) => edmingleGet(`reports/resourcestats?resource_id={resourceId}&resource_type={resourceType}&class_id={classId}`, { resourceId, resourceType, classId });
export const getExerciseAttempts = (resourceId: string, classId: string, userId: string) => edmingleGet(`exercises/{resourceId}/attemptlist?class_id={classId}&user_id={userId}&is_quiz=false`, { resourceId, classId, userId });
export const getExerciseAttemptDetails = (attemptId: string) => edmingleGet(`exercises/pasttest/{attemptId}`, { attemptId });
export const getAssignmentAttemptDetails = (attemptId: string) => edmingleGet(`assignment/pasttest/{attemptId}`, { attemptId });
export const getMaterialViews = (materialId: string, userId: string, classId: string) => edmingleGet(`materials/{materialId}/viewslist?student_id={userId}&class_id={classId}`, { materialId, userId, classId });

export const getBatchDetails = (batchId: string) => edmingleGet(`masterbatch/{batchId}`, { batchId });
