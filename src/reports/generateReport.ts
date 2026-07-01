import path from "node:path";
import type { ChangeRecord, ReviewCandidate } from "../rules/types.js";

export interface ReportInput {
  inputPath: string;
  outputPath: string;
  changes: ChangeRecord[];
  reviewCandidates: ReviewCandidate[];
  paragraphCount: number;
  changedParagraphCount: number;
  ruleFiles: string[];
}

export function generateReport(input: ReportInput): string {
  const lines: string[] = [
    "# bg-lexicon-normalizer Report",
    "",
    `- Version: 0.1.0`,
    `- Input: ${path.basename(input.inputPath)}`,
    `- Output: ${path.basename(input.outputPath)}`,
    `- Paragraphs scanned: ${input.paragraphCount}`,
    `- Paragraphs changed: ${input.changedParagraphCount}`,
    `- Changes: ${input.changes.length}`,
    `- Review candidates: ${input.reviewCandidates.length}`,
    `- Rule files: ${input.ruleFiles.join(", ")}`,
    "",
    "## Applied Changes",
    "",
    "| # | Entry | Section | Original | Normalized | Rule |",
    "|---:|---|---|---|---|---|"
  ];

  if (input.changes.length === 0) {
    lines.push("| - | - | - | No changes | - | - |");
  } else {
    input.changes.forEach((change, index) => {
      lines.push(
        `| ${index + 1} | ${cell(change.entryId)} | ${cell(change.section)} | ${cell(change.original)} | ${cell(change.normalized)} | ${cell(change.pattern)} |`
      );
    });
  }

  lines.push("", "## Review Candidates", "", "| # | Entry | Section | Candidate | Reason |", "|---:|---|---|---|---|");

  if (input.reviewCandidates.length === 0) {
    lines.push("| - | - | - | No candidates | - |");
  } else {
    input.reviewCandidates.forEach((candidate, index) => {
      lines.push(
        `| ${index + 1} | ${cell(candidate.entryId)} | ${cell(candidate.section)} | ${cell(candidate.candidate)} | ${cell(candidate.reason)} |`
      );
    });
  }

  lines.push(
    "",
    "## Notes",
    "",
    "This run used local JSON rules only. No AI service or external API was called."
  );

  return `${lines.join("\n")}\n`;
}

function cell(value: string | number | undefined): string {
  if (value === undefined || value === "") {
    return "-";
  }

  return String(value).replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();
}
