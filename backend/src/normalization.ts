import { createHash } from "node:crypto";

export const clean = (value: unknown) => String(value ?? "").trim();
export const normalizedText = (value: unknown) => clean(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
export const sourceHash = (...values: unknown[]) => createHash("sha256").update(values.map(normalizedText).join("|")).digest("hex");

export function parsePercent(value: unknown): number | null {
  const raw = clean(value).replace("%", "");
  if (!raw) return null;
  const number = Number(raw);
  return Number.isFinite(number) ? number : null;
}

export function progressStatus(value: unknown) {
  const v = normalizedText(value);
  if (v === "completed") return "completed";
  if (v === "not attempted") return "not_attempted";
  if (v === "not completed") return "not_completed";
  return "unknown";
}
