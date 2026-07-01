export { readDocx } from "./docx/readDocx.js";
export { writeDocx, transformDocumentXml } from "./docx/writeDocx.js";
export { normalizeDefinition } from "./normalizers/normalizeDefinition.js";
export { normalizeGloss } from "./normalizers/normalizeGloss.js";
export { normalizeTerminology } from "./normalizers/normalizeTerminology.js";
export { createVerbNormalizer, findVerbReviewCandidates, normalizeVerb } from "./normalizers/normalizeVerb.js";
export { generateReport } from "./reports/generateReport.js";
export { ALL_RULE_FILES, loadAllRules, loadVerbRules, RuleValidationError, VERB_RULE_FILES } from "./rules/loadRules.js";
export type {
  ChangeRecord,
  DocxWriteResult,
  LoadedRules,
  NormalizationContext,
  NormalizationResult,
  NormalizationRule,
  RuleValidationIssue,
  ReviewCandidate,
  VerbRuleType
} from "./rules/types.js";
export type { VerbNormalizer } from "./normalizers/normalizeVerb.js";
