import { importProgress } from "../import/progress.js";
const [path, collegeId, option] = process.argv.slice(2);
if (!path || !collegeId) throw new Error("Usage: npm run import:progress -- FILE.csv COLLEGE_UUID [--dry-run]");
console.log(await importProgress(path, collegeId, option === "--dry-run"));
