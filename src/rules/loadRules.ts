import { readFile } from "node:fs/promises";
import path from "node:path";
import type { LoadedRules, NormalizationRule, RuleValidationIssue } from "./types.js";

export const VERB_RULE_FILES = ["verbs.json", "passive-verbs.json", "reflexive-verbs.json"] as const;
const VERB_RULE_TYPES = ["active", "reflexive", "passive"] as const;
export const ALL_RULE_FILES = [
  ...VERB_RULE_FILES,
  "terminology.json",
  "names.json",
  "places.json"
] as const;

interface RuleFileResult {
  fileName: string;
  filePath: string;
  rules: NormalizationRule[];
  issues: RuleValidationIssue[];
}

export class RuleValidationError extends Error {
  readonly issues: RuleValidationIssue[];

  constructor(issues: RuleValidationIssue[]) {
    super(formatRuleValidationIssues(issues));
    this.name = "RuleValidationError";
    this.issues = issues;
  }
}

async function readJsonRules(fileName: string, dataDir: string): Promise<RuleFileResult> {
  const filePath = path.join(dataDir, fileName);
  const issues: RuleValidationIssue[] = [];
  let parsed: unknown;

  try {
    const raw = await readFile(filePath, "utf8");
    parsed = JSON.parse(raw) as unknown;
  } catch (error) {
    issues.push({
      filePath,
      message: error instanceof Error ? error.message : String(error)
    });
    return { fileName, filePath, rules: [], issues };
  }

  if (!Array.isArray(parsed)) {
    issues.push({ filePath, message: "rule file must contain a JSON array" });
    return { fileName, filePath, rules: [], issues };
  }

  const rules = parsed.flatMap((rule, index) => {
    const validated = validateRule(rule, filePath, index, isVerbRuleFile(fileName), issues);
    return validated ? [validated] : [];
  });

  return { fileName, filePath, rules, issues };
}

function validateRule(
  value: unknown,
  filePath: string,
  index: number,
  expectVerbCategory: boolean,
  issues: RuleValidationIssue[]
): NormalizationRule | undefined {
  if (!value || typeof value !== "object") {
    issues.push({ filePath, index, message: "expected object" });
    return undefined;
  }

  const rule = value as Record<string, unknown>;
  if (typeof rule.canonical !== "string" || rule.canonical.trim() === "") {
    issues.push({ filePath, index, field: "canonical", message: "must be a non-empty string" });
  }

  if (!Array.isArray(rule.patterns)) {
    issues.push({ filePath, index, field: "patterns", message: "must be an array of non-empty strings" });
  } else {
    rule.patterns.forEach((pattern, patternIndex) => {
      if (typeof pattern !== "string" || pattern.trim() === "") {
        issues.push({
          filePath,
          index,
          field: `patterns[${patternIndex}]`,
          message: "must be a non-empty string"
        });
      }
    });
  }

  if (typeof rule.category !== "string" || rule.category.trim() === "") {
    issues.push({ filePath, index, field: "category", message: "must be a non-empty string" });
  } else if (expectVerbCategory && rule.category.trim() !== "verb") {
    issues.push({ filePath, index, field: "category", message: "verb rule files may only contain category 'verb'" });
  }

  if (rule.type !== undefined && typeof rule.type !== "string") {
    issues.push({ filePath, index, field: "type", message: "must be a string when present" });
  } else if (expectVerbCategory && (!rule.type || !VERB_RULE_TYPES.includes(rule.type as (typeof VERB_RULE_TYPES)[number]))) {
    issues.push({ filePath, index, field: "type", message: "verb rule type must be one of: active, reflexive, passive" });
  }

  if (rule.confidence !== undefined && (typeof rule.confidence !== "number" || rule.confidence < 0 || rule.confidence > 1)) {
    issues.push({ filePath, index, field: "confidence", message: "must be a number between 0 and 1 when present" });
  }

  if (rule.notes !== undefined && typeof rule.notes !== "string") {
    issues.push({ filePath, index, field: "notes", message: "must be a string when present" });
  }

  if (rule.status !== undefined && typeof rule.status !== "string") {
    issues.push({ filePath, index, field: "status", message: "must be a string when present" });
  }

  if (rule.sources !== undefined) {
    if (!Array.isArray(rule.sources)) {
      issues.push({ filePath, index, field: "sources", message: "must be an array of strings when present" });
    } else {
      rule.sources.forEach((source, sourceIndex) => {
        if (typeof source !== "string" || source.trim() === "") {
          issues.push({
            filePath,
            index,
            field: `sources[${sourceIndex}]`,
            message: "must be a non-empty string"
          });
        }
      });
    }
  }

  if (rule.schemaVersion !== undefined && typeof rule.schemaVersion !== "string" && typeof rule.schemaVersion !== "number") {
    issues.push({ filePath, index, field: "schemaVersion", message: "must be a string or number when present" });
  }

  if (
    typeof rule.canonical !== "string" ||
    rule.canonical.trim() === "" ||
    !Array.isArray(rule.patterns) ||
    rule.patterns.some((item) => typeof item !== "string" || item.trim() === "") ||
    typeof rule.category !== "string" ||
    rule.category.trim() === "" ||
    (expectVerbCategory && rule.category.trim() !== "verb") ||
    (rule.type !== undefined && typeof rule.type !== "string") ||
    (expectVerbCategory && (!rule.type || !VERB_RULE_TYPES.includes(rule.type as (typeof VERB_RULE_TYPES)[number]))) ||
    (rule.confidence !== undefined && (typeof rule.confidence !== "number" || rule.confidence < 0 || rule.confidence > 1)) ||
    (rule.notes !== undefined && typeof rule.notes !== "string") ||
    (rule.status !== undefined && typeof rule.status !== "string") ||
    (rule.sources !== undefined && (!Array.isArray(rule.sources) || rule.sources.some((source) => typeof source !== "string" || source.trim() === ""))) ||
    (rule.schemaVersion !== undefined && typeof rule.schemaVersion !== "string" && typeof rule.schemaVersion !== "number")
  ) {
    return undefined;
  }

  return {
    canonical: rule.canonical.trim(),
    patterns: rule.patterns.map((pattern) => String(pattern).trim()),
    category: rule.category.trim(),
    type: typeof rule.type === "string" ? rule.type.trim() : undefined,
    confidence: typeof rule.confidence === "number" ? rule.confidence : undefined,
    notes: typeof rule.notes === "string" ? rule.notes : undefined,
    status: typeof rule.status === "string" ? rule.status.trim() : undefined,
    sources: Array.isArray(rule.sources) ? rule.sources.map((source) => String(source).trim()) : undefined,
    schemaVersion:
      typeof rule.schemaVersion === "string" || typeof rule.schemaVersion === "number" ? rule.schemaVersion : undefined
  };
}

export async function loadVerbRules(dataDir: string): Promise<NormalizationRule[]> {
  const results = await loadRuleFiles(dataDir, [...VERB_RULE_FILES]);
  throwIfInvalid(results);
  return dedupeRules(results.flatMap((result) => result.rules));
}

export async function loadAllRules(dataDir: string): Promise<LoadedRules> {
  const results = await loadRuleFiles(dataDir, [...ALL_RULE_FILES]);
  throwIfInvalid(results);

  const byFile = new Map(results.map((result) => [result.fileName, result.rules]));

  return {
    verbRules: dedupeRules(VERB_RULE_FILES.flatMap((file) => byFile.get(file) ?? [])),
    terminologyRules: byFile.get("terminology.json") ?? [],
    nameRules: byFile.get("names.json") ?? [],
    placeRules: byFile.get("places.json") ?? [],
    ruleFiles: [...ALL_RULE_FILES]
  };
}

async function loadRuleFiles(dataDir: string, fileNames: string[]): Promise<RuleFileResult[]> {
  return Promise.all(fileNames.map((fileName) => readJsonRules(fileName, dataDir)));
}

function throwIfInvalid(results: RuleFileResult[]): void {
  const issues = results.flatMap((result) => result.issues);
  if (issues.length > 0) {
    throw new RuleValidationError(issues);
  }
}

function isVerbRuleFile(fileName: string): boolean {
  return (VERB_RULE_FILES as readonly string[]).includes(fileName);
}

function formatRuleValidationIssues(issues: RuleValidationIssue[]): string {
  const lines = issues.map((issue) => {
    const location = issue.index === undefined ? issue.filePath : `${issue.filePath}[${issue.index}]`;
    const field = issue.field ? `.${issue.field}` : "";
    return `- ${location}${field}: ${issue.message}`;
  });

  return [`Invalid rule entries:`, ...lines].join("\n");
}

function dedupeRules(rules: NormalizationRule[]): NormalizationRule[] {
  const seen = new Set<string>();
  const result: NormalizationRule[] = [];

  for (const rule of rules) {
    const normalizedPatterns = rule.patterns.filter((pattern) => {
      const key = pattern.toLocaleLowerCase("bg-BG").replace(/\s+/g, " ").trim();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });

    if (normalizedPatterns.length > 0) {
      result.push({ ...rule, patterns: normalizedPatterns });
    }
  }

  return result;
}
