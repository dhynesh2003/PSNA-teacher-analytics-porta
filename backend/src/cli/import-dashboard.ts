import { importDashboard } from "../import/dashboard.js";
const [path, collegeId, option] = process.argv.slice(2);
if (!path || !collegeId) throw new Error("Usage: npm run import:dashboard -- FILE.csv COLLEGE_UUID [--dry-run]");
console.log(await importDashboard(path, collegeId, option === "--dry-run"));
