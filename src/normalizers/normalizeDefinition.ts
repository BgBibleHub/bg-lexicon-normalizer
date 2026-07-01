import type { NormalizationContext, NormalizationResult, NormalizationRule } from "../rules/types.js";
import { createVerbNormalizer, type VerbNormalizer } from "./normalizeVerb.js";

export function normalizeDefinition(
  input: string,
  verbRules: NormalizationRule[] | VerbNormalizer,
  context: NormalizationContext = {}
): NormalizationResult {
  const normalizer = Array.isArray(verbRules) ? createVerbNormalizer(verbRules) : verbRules;
  return normalizer.normalize(input, { ...context, source: context.source ?? "definition" });
}
