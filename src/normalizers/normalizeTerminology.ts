import type { NormalizationContext, NormalizationResult, NormalizationRule } from "../rules/types.js";

export function normalizeTerminology(
  input: string,
  _rules: NormalizationRule[],
  _context: NormalizationContext = {}
): NormalizationResult {
  return {
    text: input,
    changes: [],
    reviewCandidates: []
  };
}
