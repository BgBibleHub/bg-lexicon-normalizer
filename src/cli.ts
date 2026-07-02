#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readDocx } from "./docx/readDocx.js";
import { writeDocx } from "./docx/writeDocx.js";
import { normalizeDefinition } from "./normalizers/normalizeDefinition.js";
import { normalizeGloss } from "./normalizers/normalizeGloss.js";
import { createVerbNormalizer } from "./normalizers/normalizeVerb.js";
import { resolveSourceProfile } from "./profiles/sourceProfile.js";
import { generateReport } from "./reports/generateReport.js";
import { loadAllRules } from "./rules/loadRules.js";
import type { ReviewCandidate } from "./rules/types.js";

const VERSION = "0.1.0";

export async function main(argv = process.argv.slice(2)): Promise<void> {
  if (argv.length === 0 || argv.includes("--help") || argv.includes("-h")) {
    printUsage();
    return;
  }

  if (argv.includes("--version") || argv.includes("-v")) {
    console.log(VERSION);
    return;
  }

  const inputArg = argv[0];
  if (!inputArg) {
    throw new Error("Missing input DOCX path");
  }

  const outDir = readOption(argv, "--out-dir") ?? "output";
  const profileOption = readOption(argv, "--profile");
  const inputPath = path.resolve(inputArg);
  const outputDir = path.resolve(outDir);
  const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const dataDir = path.join(projectRoot, "data");
  const rules = await loadAllRules(dataDir);
  const verbNormalizer = createVerbNormalizer(rules.verbRules);

  await mkdir(outputDir, { recursive: true });

  const outputDocx = path.join(outputDir, `${path.basename(inputPath, path.extname(inputPath))}.normalized.docx`);
  const docx = await readDocx(inputPath);
  const profile = resolveSourceProfile(profileOption, docx.documentXml);
  const writeResult = await writeDocx(docx, outputDocx, (text, context) => {
    return profile.normalizeParagraph(text, context, {
      gloss: (value, normalizationContext) => normalizeGloss(value, verbNormalizer, normalizationContext),
      definition: (value, normalizationContext) => normalizeDefinition(value, verbNormalizer, normalizationContext),
      lexical: (value, normalizationContext) => normalizeDefinition(value, verbNormalizer, normalizationContext)
    });
  });

  const changes = sortChanges(writeResult.changes);
  const reviewCandidates = dedupeReviewCandidates(writeResult.reviewCandidates);
  const changesPath = path.join(outputDir, "changes.json");
  const candidatesPath = path.join(outputDir, "review-candidates.json");
  const reportPath = path.join(outputDir, "report.md");

  await Promise.all([
    writeFile(changesPath, `${JSON.stringify(changes, null, 2)}\n`, "utf8"),
    writeFile(candidatesPath, `${JSON.stringify(reviewCandidates, null, 2)}\n`, "utf8"),
    writeFile(
      reportPath,
      generateReport({
        inputPath,
        outputPath: outputDocx,
        changes,
        reviewCandidates,
        paragraphCount: writeResult.paragraphCount,
        changedParagraphCount: writeResult.changedParagraphCount,
        ruleFiles: rules.ruleFiles
      }),
      "utf8"
    )
  ]);

  console.log(`Normalized DOCX: ${outputDocx}`);
  console.log(`Profile: ${profile.name}`);
  console.log(`Changes: ${writeResult.changes.length}`);
  console.log(`Review candidates: ${reviewCandidates.length}`);
}

function readOption(argv: string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  if (index === -1) {
    return undefined;
  }

  return argv[index + 1];
}

function dedupeReviewCandidates(candidates: ReviewCandidate[]): ReviewCandidate[] {
  const seen = new Set<string>();
  const frequencies = countReviewCandidateFrequencies(candidates);
  const result: ReviewCandidate[] = [];

  for (const candidate of candidates) {
    const candidateKey = candidate.candidate.toLocaleLowerCase("bg-BG").replace(/\s+/g, " ").trim();
    const key = [candidate.entryId ?? "", candidate.section ?? "", candidateKey, candidate.classifierType].join("|");
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push({ ...candidate, frequency: frequencies.get(candidateKey) ?? 1 });
  }

  return result;
}

function countReviewCandidateFrequencies(candidates: ReviewCandidate[]): Map<string, number> {
  const frequencies = new Map<string, number>();

  for (const candidate of candidates) {
    const key = candidate.candidate.toLocaleLowerCase("bg-BG").replace(/\s+/g, " ").trim();
    frequencies.set(key, (frequencies.get(key) ?? 0) + 1);
  }

  return frequencies;
}

function sortChanges<T extends { entryId?: string; section?: string; offset: number }>(changes: T[]): T[] {
  return [...changes].sort((left, right) => {
    const leftEntry = left.entryId ?? "";
    const rightEntry = right.entryId ?? "";
    if (leftEntry !== rightEntry) {
      return leftEntry.localeCompare(rightEntry);
    }

    const leftSection = left.section ?? "";
    const rightSection = right.section ?? "";
    if (leftSection !== rightSection) {
      return leftSection.localeCompare(rightSection);
    }

    return left.offset - right.offset;
  });
}

function printUsage(): void {
  console.log(`bg-lexicon-normalizer ${VERSION}

Usage:
  npm run normalize input.docx
  npm run normalize input.docx -- --out-dir output
  npm run normalize input.docx -- --profile auto
  npm run normalize input.docx -- --profile step-minimal
  npm run normalize input.docx -- --profile leh-inline

This tool is offline and applies only local JSON normalization rules.`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Error: ${message}`);
  process.exitCode = 1;
});
