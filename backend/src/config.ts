import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  PORT: z.coerce.number().int().positive().default(8787),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_ORIGIN: z.string().min(1),
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(10),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(10),
  EDMINGLE_BASE_URL: z.string().url(),
  EDMINGLE_INSTITUTION_ID: z.string().min(1),
  EDMINGLE_API_KEY: z.string().min(1),
  PSNA_COLLEGE_ID: z.string().uuid().default("11111111-1111-1111-1111-111111111111"),
  EDMINGLE_PSNA_ORG_ID: z.string().regex(/^\d+$/).default("5173"),
  EDMINGLE_PSNA_BUNDLE_IDS: z.string().default("75069,75072,75113"),
  EDMINGLE_PSNA_MASTER_BATCH_IDS: z.string().default(
    "223658,223660,223661,227683,223621,223625,223630,223641,223644,223648,227682,223571,223574,223585,223591,223600,223601,223602,223605,227676"
  ),
  EDMINGLE_MIN_GAP_MS: z.coerce.number().int().min(2000).default(3100),
  EDMINGLE_ORGANIZATIONS_PATH: z.string().min(1),
  EDMINGLE_BATCHES_PATH: z.string().optional(),
  EDMINGLE_STUDENTS_PATH: z.string().optional(),
  EDMINGLE_PROGRESS_PATH: z.string().optional(),
  EDMINGLE_ASSESSMENTS_PATH: z.string().optional(),
  EDMINGLE_SUBMISSIONS_PATH: z.string().optional()
});

const parsed = schema.parse(process.env);
const parseIds = (value: string) => value.split(",").map(item => item.trim()).filter(Boolean);

export const config = {
  ...parsed,
  PSNA_BUNDLE_IDS: parseIds(parsed.EDMINGLE_PSNA_BUNDLE_IDS),
  PSNA_MASTER_BATCH_IDS: parseIds(parsed.EDMINGLE_PSNA_MASTER_BATCH_IDS)
};
