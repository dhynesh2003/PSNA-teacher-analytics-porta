import type { NextFunction, Request, Response } from "express";
import { authClient, adminDb } from "../supabase.js";
import { config } from "../config.js";

export type Access = { userId: string; collegeId: string; role: string };
declare global { namespace Express { interface Request { access?: Access } } }

export async function requireCollegeAccess(req: Request, res: Response, next: NextFunction) {
  const token = req.header("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ error: "AUTH_REQUIRED" });

  const { data: userData, error: userError } = await authClient.auth.getUser(token);
  if (userError || !userData.user) return res.status(401).json({ error: "INVALID_SESSION" });

  const profile = await adminDb.from("profiles").select("college_id, role")
    .eq("id", userData.user.id).maybeSingle();
  if (profile.error) return next(profile.error);

  let collegeId = profile.data?.college_id ? String(profile.data.college_id) : "";
  let role = profile.data?.role ? String(profile.data.role) : "";
  if (!collegeId) {
    const fallback = await adminDb.from("user_college_access").select("college_id, role")
      .eq("user_id", userData.user.id).eq("active", true).limit(1).maybeSingle();
    if (fallback.error) return next(fallback.error);
    collegeId = fallback.data?.college_id ? String(fallback.data.college_id) : "";
    role = fallback.data?.role ? String(fallback.data.role) : "";
  }
  if (!collegeId) return res.status(403).json({ error: "NO_COLLEGE_ACCESS" });
  if (collegeId !== config.PSNA_COLLEGE_ID) return res.status(403).json({ error: "PSNA_ACCESS_REQUIRED" });
  if (!["faculty", "hod", "super_admin", "teacher", "college_admin"].includes(role)) {
    return res.status(403).json({ error: "TEACHER_ROLE_REQUIRED" });
  }

  req.access = { userId: userData.user.id, collegeId, role };
  next();
}
