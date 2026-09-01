import { syncPsnaAnalytics, type SyncMode } from "../sync/psna.js";

const modeArgument = process.argv.slice(2).find(argument => argument.startsWith("--mode="));
const mode = (modeArgument?.split("=")[1] ?? "full") as SyncMode;
if (
  !(["roster", "full", "submissions"] as const)
    .includes(mode)
) {
  throw new Error(
    "Use --mode=roster, --mode=full, or --mode=submissions"
  );
}

console.log(`Starting PSNA ${mode} sync. This is intentionally rate-limited and a full sync can take time.`);
const result = await syncPsnaAnalytics(mode, progress => {
  const percent = progress.total ? Math.round(progress.completed / progress.total * 100) : 0;
  console.log(`[${progress.stage}] ${progress.completed}/${progress.total} (${percent}%)${progress.detail ? ` - ${progress.detail}` : ""}`);
});
console.log(JSON.stringify(result, null, 2));

