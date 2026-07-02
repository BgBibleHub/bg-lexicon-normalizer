import path from "node:path";
import { fileURLToPath } from "node:url";
import { runCurationSession } from "./curateCandidates.js";

function usage(): string {
  return [
    "Usage:",
    "  npm run curate -- output/review-candidates.json",
    "",
    "Offline curation only. Reads review candidates, appends approved verb rules,",
    "and writes curation-log.json next to the candidate file."
  ].join("\n");
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h") || args.length !== 1) {
    console.log(usage());
    process.exit(args.length === 1 ? 0 : 1);
  }

  const candidatesPath = path.resolve(args[0]);
  const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  const dataDir = path.join(projectRoot, "data");
  const result = await runCurationSession({
    candidatesPath,
    dataDir,
    outputDir: path.dirname(candidatesPath),
    input: process.stdin,
    output: process.stdout
  });

  console.log("");
  console.log(`Processed: ${result.processed}`);
  console.log(`Written: ${result.written}`);
  console.log(`Skipped: ${result.skipped}`);
  console.log(`Rejected: ${result.rejected}`);
  console.log(`Duplicates: ${result.duplicates}`);
  console.log(`Conflicts: ${result.conflicts}`);
  console.log(`Log: ${result.logPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
