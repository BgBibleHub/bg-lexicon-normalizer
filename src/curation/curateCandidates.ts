import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createInterface, type Interface } from "node:readline/promises";
import type { Readable, Writable } from "node:stream";
import type { NormalizationRule, ReviewCandidate, VerbCandidateType, VerbRuleType } from "../rules/types.js";
import type {
  CandidateGroup,
  CuratedVerbType,
  CurationDecision,
  CurationLogEntry,
  CurationResult,
  ExistingPattern,
  RuleFileState
} from "./types.js";

const VERB_RULE_FILE_BY_TYPE: Record<CuratedVerbType, string> = {
  active: "verbs.json",
  passive: "passive-verbs.json",
  reflexive: "reflexive-verbs.json"
};

const CURATED_SCOPE = ["gloss", "definition", "lexical"] as const;

export interface RunCurationSessionOptions {
  candidatesPath: string;
  dataDir: string;
  outputDir?: string;
  decisions?: CurationDecision[];
  input?: Readable;
  output?: Writable;
  now?: () => Date;
}

interface PromptDecisionOptions {
  group: CandidateGroup;
  suggestedCanonical: string;
  rl: Interface;
  output: Writable;
}

interface PreparedDecision {
  action: CurationDecision["action"];
  canonical?: string;
  type?: VerbRuleType;
}

export async function runCurationSession(options: RunCurationSessionOptions): Promise<CurationResult> {
  const candidatesPath = path.resolve(options.candidatesPath);
  const dataDir = path.resolve(options.dataDir);
  const outputDir = path.resolve(options.outputDir ?? path.dirname(candidatesPath));
  const logPath = path.join(outputDir, "curation-log.json");
  const now = options.now ?? (() => new Date());
  const output = options.output ?? process.stdout;
  const groups = groupCandidates(await readReviewCandidates(candidatesPath));
  const ruleFiles = await readRuleFiles(dataDir);
  const existingPatterns = indexExistingPatterns(ruleFiles);
  const logEntries: CurationLogEntry[] = [];
  let decisionIndex = 0;
  let rl: Interface | undefined;

  if (!options.decisions) {
    rl = createInterface({
      input: options.input ?? process.stdin,
      output
    });
  }

  const result: CurationResult = {
    processed: 0,
    written: 0,
    skipped: 0,
    rejected: 0,
    duplicates: 0,
    conflicts: 0,
    quit: false,
    logPath
  };

  try {
    for (const group of groups) {
      const suggestedCanonical = suggestCanonical(group.candidate, group.classifierType);
      const rawDecision = options.decisions
        ? options.decisions[decisionIndex++] ?? { action: "quit" as const }
        : await promptDecision({ group, suggestedCanonical, rl: rl as Interface, output });
      const decision = prepareDecision(rawDecision, group, suggestedCanonical);

      result.processed += 1;

      if (decision.action === "quit") {
        result.quit = true;
        logEntries.push(createLogEntry(candidatesPath, group, decision, now));
        break;
      }

      if (decision.action === "skip") {
        result.skipped += 1;
        logEntries.push(createLogEntry(candidatesPath, group, decision, now));
        continue;
      }

      if (decision.action === "reject") {
        result.rejected += 1;
        logEntries.push(createLogEntry(candidatesPath, group, decision, now));
        continue;
      }

      if (!decision.canonical || !decision.type) {
        result.skipped += 1;
        logEntries.push(
          createLogEntry(candidatesPath, group, { action: "skip", message: "missing canonical or rule type" }, now)
        );
        continue;
      }

      const duplicate = existingPatterns.get(normalizePatternKey(group.candidate));
      const targetRuleFile = VERB_RULE_FILE_BY_TYPE[decision.type];

      if (duplicate) {
        const sameCanonical = normalizeTextKey(duplicate.rule.canonical) === normalizeTextKey(decision.canonical);
        const logEntry = createLogEntry(
          candidatesPath,
          group,
          {
            ...decision,
            targetRuleFile,
            duplicate: sameCanonical,
            conflict: !sameCanonical,
            message: sameCanonical
              ? `Pattern already exists in ${duplicate.fileName}.`
              : `Pattern exists in ${duplicate.fileName} with canonical '${duplicate.rule.canonical}'.`
          },
          now
        );

        logEntries.push(logEntry);
        if (sameCanonical) {
          result.duplicates += 1;
        } else {
          result.conflicts += 1;
          result.quit = true;
          output.write(`Conflict: ${logEntry.message}\n`);
          break;
        }
        continue;
      }

      const rule = createCuratedRule(group.candidate, decision.canonical, decision.type);
      const targetFile = ruleFiles.get(targetRuleFile);

      if (!targetFile) {
        throw new Error(`Missing rule file state for ${targetRuleFile}`);
      }

      targetFile.rules.push(rule);
      targetFile.dirty = true;
      existingPatterns.set(normalizePatternKey(group.candidate), {
        fileName: targetRuleFile,
        rule,
        pattern: group.candidate
      });
      result.written += 1;
      logEntries.push(createLogEntry(candidatesPath, group, { ...decision, targetRuleFile, rule }, now));
    }
  } finally {
    rl?.close();
  }

  await writeChangedRuleFiles(ruleFiles);
  await appendCurationLog(logPath, logEntries);

  return result;
}

export function groupCandidates(candidates: ReviewCandidate[]): CandidateGroup[] {
  const groups = new Map<string, CandidateGroup>();

  for (const candidate of candidates) {
    const key = `${normalizePatternKey(candidate.candidate)}\u0000${candidate.classifierType}`;
    const existing = groups.get(key);
    const frequency = typeof candidate.frequency === "number" && candidate.frequency > 0 ? candidate.frequency : 1;

    if (existing) {
      existing.frequency = Math.max(existing.frequency, frequency);
      if (candidate.section && !existing.sections.includes(candidate.section)) {
        existing.sections.push(candidate.section);
      }
      if (existing.examples.length < 5) {
        existing.examples.push(candidate);
      }
      continue;
    }

    groups.set(key, {
      candidate: candidate.candidate,
      classifierType: candidate.classifierType,
      frequency,
      sections: candidate.section ? [candidate.section] : [],
      examples: [candidate]
    });
  }

  return [...groups.values()].sort((left, right) => {
    const frequency = right.frequency - left.frequency;
    if (frequency !== 0) {
      return frequency;
    }

    const typeOrder = left.classifierType.localeCompare(right.classifierType, "bg");
    if (typeOrder !== 0) {
      return typeOrder;
    }

    return left.candidate.localeCompare(right.candidate, "bg");
  });
}

export function suggestCanonical(candidate: string, classifierType: VerbCandidateType): string {
  const normalized = candidate.trim().replace(/\s+/g, " ");

  if (classifierType === "passive") {
    return normalized.replace(/^да\s+(?:бъде|бъда)\s+/iu, "").replace(/\s+/g, " ").trim() + " съм";
  }

  const reflexiveMatch = normalized.match(/^да\s+се\s+(.+)$/iu);
  if (reflexiveMatch?.[1]) {
    return `${reflexiveMatch[1].trim()} се`;
  }

  return normalized.replace(/^да\s+/iu, "").trim();
}

function prepareDecision(
  decision: CurationDecision,
  group: CandidateGroup,
  suggestedCanonical: string
): PreparedDecision & { message?: string; targetRuleFile?: string; duplicate?: boolean; conflict?: boolean; rule?: NormalizationRule } {
  if (decision.action === "accept") {
    const type = inferVerbType(group.classifierType, group.candidate);
    return { action: "accept", canonical: decision.canonical?.trim() || suggestedCanonical, type };
  }

  if (decision.action === "edit") {
    const type = inferVerbType(group.classifierType, decision.canonical ?? group.candidate);
    return { action: "edit", canonical: decision.canonical?.trim(), type };
  }

  if (decision.action === "passive") {
    return { action: "passive", canonical: decision.canonical?.trim() || suggestedCanonical, type: "passive" };
  }

  if (decision.action === "reflexive") {
    return { action: "reflexive", canonical: decision.canonical?.trim() || suggestedCanonical, type: "reflexive" };
  }

  return { action: decision.action };
}

function inferVerbType(classifierType: VerbCandidateType, text: string): VerbRuleType {
  if (classifierType === "passive") {
    return "passive";
  }

  if (/^да\s+се\s+/iu.test(text) || /\sсе$/iu.test(text.trim())) {
    return "reflexive";
  }

  return "active";
}

function createCuratedRule(pattern: string, canonical: string, type: VerbRuleType): NormalizationRule {
  return {
    canonical,
    patterns: [pattern],
    category: "verb",
    type,
    scope: [...CURATED_SCOPE],
    status: "approved",
    sources: ["curation"],
    confidence: 1
  };
}

async function readReviewCandidates(candidatesPath: string): Promise<ReviewCandidate[]> {
  const raw = await readFile(candidatesPath, "utf8");
  const parsed = JSON.parse(raw) as unknown;

  if (!Array.isArray(parsed)) {
    throw new Error("review-candidates.json must contain a JSON array");
  }

  return parsed.filter(isReviewCandidate);
}

function isReviewCandidate(value: unknown): value is ReviewCandidate {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<ReviewCandidate>;
  return typeof candidate.candidate === "string" && typeof candidate.classifierType === "string";
}

async function readRuleFiles(dataDir: string): Promise<Map<string, RuleFileState>> {
  const states = new Map<string, RuleFileState>();

  for (const fileName of Object.values(VERB_RULE_FILE_BY_TYPE)) {
    const filePath = path.join(dataDir, fileName);
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as unknown;

    if (!Array.isArray(parsed)) {
      throw new Error(`${fileName} must contain a JSON array`);
    }

    states.set(fileName, {
      fileName,
      filePath,
      rules: parsed as NormalizationRule[],
      dirty: false
    });
  }

  return states;
}

function indexExistingPatterns(ruleFiles: Map<string, RuleFileState>): Map<string, ExistingPattern> {
  const index = new Map<string, ExistingPattern>();

  for (const state of ruleFiles.values()) {
    for (const rule of state.rules) {
      for (const pattern of rule.patterns ?? []) {
        index.set(normalizePatternKey(pattern), {
          fileName: state.fileName,
          rule,
          pattern
        });
      }
    }
  }

  return index;
}

async function writeChangedRuleFiles(ruleFiles: Map<string, RuleFileState>): Promise<void> {
  await Promise.all(
    [...ruleFiles.values()]
      .filter((state) => state.dirty)
      .map((state) => writeFile(state.filePath, `${JSON.stringify(state.rules, null, 2)}\n`, "utf8"))
  );
}

async function appendCurationLog(logPath: string, entries: CurationLogEntry[]): Promise<void> {
  await mkdir(path.dirname(logPath), { recursive: true });
  const existing = await readExistingLog(logPath);
  await writeFile(logPath, `${JSON.stringify([...existing, ...entries], null, 2)}\n`, "utf8");
}

async function readExistingLog(logPath: string): Promise<CurationLogEntry[]> {
  try {
    const raw = await readFile(logPath, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as CurationLogEntry[]) : [];
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

function createLogEntry(
  inputCandidateFile: string,
  group: CandidateGroup,
  decision: PreparedDecision & {
    targetRuleFile?: string;
    rule?: NormalizationRule;
    duplicate?: boolean;
    conflict?: boolean;
    message?: string;
  },
  now: () => Date
): CurationLogEntry {
  return {
    timestamp: now().toISOString(),
    inputCandidateFile,
    candidate: group.candidate,
    classifierType: group.classifierType,
    frequency: group.frequency,
    action: decision.action,
    canonical: decision.canonical,
    targetRuleFile: decision.targetRuleFile,
    rule: decision.rule,
    duplicate: decision.duplicate,
    conflict: decision.conflict,
    message: decision.message,
    sampleContexts: group.examples.map((example) => example.context).filter(Boolean)
  };
}

async function promptDecision(options: PromptDecisionOptions): Promise<CurationDecision> {
  const { group, suggestedCanonical, rl, output } = options;
  output.write("\n");
  output.write(`Candidate: ${group.candidate}\n`);
  output.write(`Type: ${group.classifierType}\n`);
  output.write(`Frequency: ${group.frequency}\n`);

  if (group.sections.length > 0) {
    output.write(`Sections: ${group.sections.join(", ")}\n`);
  }

  output.write("Examples:\n");
  group.examples.slice(0, 3).forEach((example, index) => {
    const location = [example.entryId, example.section].filter(Boolean).join(" ");
    output.write(`${index + 1}. ${location ? `${location}: ` : ""}${example.context}\n`);
  });

  output.write(`Suggested canonical: ${suggestedCanonical}\n`);
  const action = (await rl.question("[a]ccept [e]dit [p]assive [r]eflexive [s]kip reject[x] [q]uit: "))
    .trim()
    .toLowerCase();

  if (action === "q") {
    return { action: "quit" };
  }
  if (action === "s") {
    return { action: "skip" };
  }
  if (action === "x") {
    return { action: "reject" };
  }
  if (action === "e") {
    return { action: "edit", canonical: await askCanonical(rl, suggestedCanonical) };
  }
  if (action === "p") {
    return { action: "passive", canonical: await askCanonical(rl, suggestedCanonical) };
  }
  if (action === "r") {
    return { action: "reflexive", canonical: await askCanonical(rl, suggestedCanonical) };
  }

  if (action === "a" || (action === "" && group.classifierType !== "complex-phrase")) {
    return { action: "accept", canonical: suggestedCanonical };
  }

  return { action: "skip" };
}

async function askCanonical(rl: Interface, fallback: string): Promise<string> {
  const answer = (await rl.question(`Canonical [${fallback}]: `)).trim();
  return answer || fallback;
}

function normalizePatternKey(value: string): string {
  return normalizeTextKey(value);
}

function normalizeTextKey(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("bg");
}
