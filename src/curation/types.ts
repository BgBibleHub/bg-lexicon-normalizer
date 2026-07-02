import type { NormalizationRule, ReviewCandidate, VerbRuleType } from "../rules/types.js";

export type CurationAction = "accept" | "edit" | "passive" | "reflexive" | "skip" | "reject" | "quit";

export interface CurationDecision {
  action: CurationAction;
  canonical?: string;
}

export interface CandidateGroup {
  candidate: string;
  classifierType: ReviewCandidate["classifierType"];
  frequency: number;
  sections: string[];
  examples: ReviewCandidate[];
}

export interface CurationLogEntry {
  timestamp: string;
  inputCandidateFile: string;
  candidate: string;
  classifierType: ReviewCandidate["classifierType"];
  frequency: number;
  action: CurationAction;
  canonical?: string;
  targetRuleFile?: string;
  rule?: NormalizationRule;
  duplicate?: boolean;
  conflict?: boolean;
  message?: string;
  sampleContexts: string[];
}

export interface CurationResult {
  processed: number;
  written: number;
  skipped: number;
  rejected: number;
  duplicates: number;
  conflicts: number;
  quit: boolean;
  logPath: string;
}

export interface ExistingPattern {
  fileName: string;
  rule: NormalizationRule;
  pattern: string;
}

export interface RuleFileState {
  fileName: string;
  filePath: string;
  rules: NormalizationRule[];
  dirty: boolean;
}

export type CuratedVerbType = VerbRuleType;
