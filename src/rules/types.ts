export type VerbRuleType = "active" | "reflexive" | "passive";
export type RuleScope = "gloss" | "definition" | "lexical";
export type VerbCandidateType = "simple-infinitive" | "passive" | "complex-phrase";

export interface NormalizationRule {
  canonical: string;
  patterns: string[];
  category: string;
  type?: VerbRuleType | string;
  confidence?: number;
  notes?: string;
  status?: string;
  sources?: string[];
  schemaVersion?: string | number;
  scope?: RuleScope[];
}

export interface LoadedRules {
  verbRules: NormalizationRule[];
  terminologyRules: NormalizationRule[];
  nameRules: NormalizationRule[];
  placeRules: NormalizationRule[];
  ruleFiles: string[];
}

export interface RuleValidationIssue {
  filePath: string;
  index?: number;
  field?: string;
  message: string;
}

export interface NormalizationContext {
  entryId?: string;
  section?: string;
  source?: string;
}

export interface ChangeRecord extends NormalizationContext {
  original: string;
  normalized: string;
  pattern: string;
  canonical: string;
  category: string;
  type?: string;
  confidence?: number;
  offset: number;
  context: string;
  paragraphBefore: string;
  paragraphAfter: string;
}

export interface ReviewCandidate extends NormalizationContext {
  candidate: string;
  classifierType: VerbCandidateType;
  frequency?: number;
  reason: string;
  offset: number;
  context: string;
}

export interface NormalizationResult {
  text: string;
  changes: ChangeRecord[];
  reviewCandidates: ReviewCandidate[];
}

export interface DocxWriteResult {
  changes: ChangeRecord[];
  reviewCandidates: ReviewCandidate[];
  paragraphCount: number;
  changedParagraphCount: number;
}
