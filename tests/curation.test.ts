import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { runCurationSession } from "../src/curation/curateCandidates.js";
import type { CurationLogEntry } from "../src/curation/types.js";
import type { NormalizationRule, ReviewCandidate } from "../src/rules/types.js";

describe("runCurationSession", () => {
  it("accepts a candidate with the suggested canonical form", async () => {
    const fixture = await makeFixture([
      candidate("да летя", "simple-infinitive", 3, "G", "да летя")
    ]);

    const result = await runCurationSession({
      candidatesPath: fixture.candidatesPath,
      dataDir: fixture.dataDir,
      outputDir: fixture.outputDir,
      decisions: [{ action: "accept" }],
      now: fixedNow
    });

    const verbs = await readRules(path.join(fixture.dataDir, "verbs.json"));

    expect(result.written).toBe(1);
    expect(verbs).toContainEqual(
      expect.objectContaining({
        canonical: "летя",
        patterns: ["да летя"],
        category: "verb",
        type: "active",
        scope: ["gloss", "definition", "lexical"],
        status: "approved",
        sources: ["curation"],
        confidence: 1
      })
    );
  });

  it("edits canonical form before writing a rule", async () => {
    const fixture = await makeFixture([
      candidate("да скърбя", "simple-infinitive", 1, "D", "... да скърбя ...")
    ]);

    await runCurationSession({
      candidatesPath: fixture.candidatesPath,
      dataDir: fixture.dataDir,
      outputDir: fixture.outputDir,
      decisions: [{ action: "edit", canonical: "скърбя" }],
      now: fixedNow
    });

    const verbs = await readRules(path.join(fixture.dataDir, "verbs.json"));

    expect(verbs).toContainEqual(expect.objectContaining({ canonical: "скърбя", patterns: ["да скърбя"] }));
  });

  it("routes passive and reflexive decisions to their rule files", async () => {
    const fixture = await makeFixture([
      candidate("да бъда невеж", "passive", 2, "D", "да бъда невеж"),
      candidate("да се радвам", "simple-infinitive", 4, "G", "да се радвам")
    ]);

    await runCurationSession({
      candidatesPath: fixture.candidatesPath,
      dataDir: fixture.dataDir,
      outputDir: fixture.outputDir,
      decisions: [
        { action: "reflexive", canonical: "радвам се" },
        { action: "passive", canonical: "невеж съм" }
      ],
      now: fixedNow
    });

    const verbs = await readRules(path.join(fixture.dataDir, "verbs.json"));
    const passive = await readRules(path.join(fixture.dataDir, "passive-verbs.json"));
    const reflexive = await readRules(path.join(fixture.dataDir, "reflexive-verbs.json"));

    expect(verbs).toEqual([]);
    expect(passive).toContainEqual(
      expect.objectContaining({ canonical: "невеж съм", patterns: ["да бъда невеж"], type: "passive" })
    );
    expect(reflexive).toContainEqual(
      expect.objectContaining({ canonical: "радвам се", patterns: ["да се радвам"], type: "reflexive" })
    );
  });

  it("prevents duplicate rules across all verb rule files", async () => {
    const fixture = await makeFixture(
      [candidate("да летя", "simple-infinitive", 5, "G", "да летя")],
      {
        "verbs.json": [rule("летя", ["да летя"], "active")],
        "passive-verbs.json": [],
        "reflexive-verbs.json": []
      }
    );

    const result = await runCurationSession({
      candidatesPath: fixture.candidatesPath,
      dataDir: fixture.dataDir,
      outputDir: fixture.outputDir,
      decisions: [{ action: "accept" }],
      now: fixedNow
    });

    const verbs = await readRules(path.join(fixture.dataDir, "verbs.json"));
    const log = await readLog(path.join(fixture.outputDir, "curation-log.json"));

    expect(result.written).toBe(0);
    expect(result.duplicates).toBe(1);
    expect(verbs).toHaveLength(1);
    expect(log[0]).toEqual(expect.objectContaining({ candidate: "да летя", duplicate: true }));
  });

  it("writes curation-log.json for accepted, skipped, and rejected decisions", async () => {
    const fixture = await makeFixture([
      candidate("да летя", "simple-infinitive", 3, "G", "да летя"),
      candidate("да говоря", "simple-infinitive", 2, "D", "да говоря"),
      candidate("да видя ясно", "complex-phrase", 1, "D", "да видя ясно")
    ]);

    const result = await runCurationSession({
      candidatesPath: fixture.candidatesPath,
      dataDir: fixture.dataDir,
      outputDir: fixture.outputDir,
      decisions: [{ action: "accept" }, { action: "skip" }, { action: "reject" }],
      now: fixedNow
    });

    const log = await readLog(result.logPath);

    expect(log).toHaveLength(3);
    expect(log[0]).toEqual(
      expect.objectContaining({
        timestamp: "2026-01-02T03:04:05.000Z",
        inputCandidateFile: fixture.candidatesPath,
        candidate: "да летя",
        action: "accept",
        canonical: "летя",
        targetRuleFile: "verbs.json",
        sampleContexts: ["да летя"]
      })
    );
    expect(log[1]).toEqual(expect.objectContaining({ candidate: "да говоря", action: "skip" }));
    expect(log[2]).toEqual(expect.objectContaining({ candidate: "да видя ясно", action: "reject" }));
  });
});

interface Fixture {
  rootDir: string;
  dataDir: string;
  outputDir: string;
  candidatesPath: string;
}

async function makeFixture(
  candidates: ReviewCandidate[],
  rules: Record<string, NormalizationRule[]> = {
    "verbs.json": [],
    "passive-verbs.json": [],
    "reflexive-verbs.json": []
  }
): Promise<Fixture> {
  const rootDir = await mkdtemp(path.join(tmpdir(), "bg-lexicon-curation-"));
  const dataDir = path.join(rootDir, "data");
  const outputDir = path.join(rootDir, "output");
  const candidatesPath = path.join(outputDir, "review-candidates.json");

  await Promise.all([
    writeFile(path.join(rootDir, ".keep"), "", "utf8"),
    writeJson(path.join(dataDir, "verbs.json"), rules["verbs.json"] ?? []),
    writeJson(path.join(dataDir, "passive-verbs.json"), rules["passive-verbs.json"] ?? []),
    writeJson(path.join(dataDir, "reflexive-verbs.json"), rules["reflexive-verbs.json"] ?? []),
    writeJson(candidatesPath, candidates)
  ]);

  return { rootDir, dataDir, outputDir, candidatesPath };
}

function candidate(
  candidateText: string,
  classifierType: ReviewCandidate["classifierType"],
  frequency: number,
  section: string,
  context: string
): ReviewCandidate {
  return {
    candidate: candidateText,
    classifierType,
    frequency,
    reason: "unmatched Bulgarian да-form",
    offset: 0,
    context,
    entryId: "000001",
    section
  };
}

function rule(canonical: string, patterns: string[], type: NormalizationRule["type"]): NormalizationRule {
  return {
    canonical,
    patterns,
    category: "verb",
    type,
    confidence: 1
  };
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function readRules(filePath: string): Promise<NormalizationRule[]> {
  return JSON.parse(await readFile(filePath, "utf8")) as NormalizationRule[];
}

async function readLog(filePath: string): Promise<CurationLogEntry[]> {
  return JSON.parse(await readFile(filePath, "utf8")) as CurationLogEntry[];
}

function fixedNow(): Date {
  return new Date("2026-01-02T03:04:05.000Z");
}
