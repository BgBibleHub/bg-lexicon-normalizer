import type {
  ChangeRecord,
  NormalizationContext,
  NormalizationResult,
  NormalizationRule,
  RuleScope,
  ReviewCandidate
} from "../rules/types.js";

interface CompiledPattern {
  rule: NormalizationRule;
  pattern: string;
  regex: RegExp;
  order: number;
}

interface PendingChange {
  start: number;
  end: number;
  original: string;
  normalized: string;
  compiled: CompiledPattern;
}

export interface VerbNormalizer {
  readonly rules: NormalizationRule[];
  normalize(input: string, context?: NormalizationContext): NormalizationResult;
}

const PROTECTED_TOKEN_REGEX = /@@[^@\r\n]*@@|\b[GH]\d{1,6}\b/gu;
const CYRILLIC_REGEX = /\p{Script=Cyrillic}/u;
const VERB_CANDIDATE_REGEX = /(^|[^\p{L}\p{N}@])((?:да|Да)\s+(?:(?:се|бъде|бъда)\s+)?\p{Script=Cyrillic}+(?:\s+\p{Script=Cyrillic}+){0,2})/gu;

export function createVerbNormalizer(rules: NormalizationRule[]): VerbNormalizer {
  const compiledPatterns = compilePatterns(rules);

  return {
    rules,
    normalize(input: string, context: NormalizationContext = {}): NormalizationResult {
      return normalizeWithCompiledPatterns(input, rules, compiledPatterns, context);
    }
  };
}

export function normalizeVerb(
  input: string,
  rules: NormalizationRule[],
  context: NormalizationContext = {}
): NormalizationResult {
  return createVerbNormalizer(rules).normalize(input, context);
}

function normalizeWithCompiledPatterns(
  input: string,
  rules: NormalizationRule[],
  compiledPatterns: CompiledPattern[],
  context: NormalizationContext
): NormalizationResult {
  if (!CYRILLIC_REGEX.test(input)) {
    return {
      text: input,
      changes: [],
      reviewCandidates: []
    };
  }

  const pendingChanges = findPendingChanges(input, compiledPatterns, context);
  const text = applyPendingChanges(input, pendingChanges);
  const changes = pendingChanges.map((pending) => toChangeRecord(pending, context, input, text));

  return {
    text,
    changes,
    reviewCandidates: findVerbReviewCandidates(text, rules, context)
  };
}

export function findVerbReviewCandidates(
  input: string,
  rules: NormalizationRule[],
  context: NormalizationContext = {}
): ReviewCandidate[] {
  const knownPatterns = new Set(
    rules
      .filter((rule) => ruleAppliesToContext(rule, context))
      .flatMap((rule) => rule.patterns.map((pattern) => normalizeKey(pattern)))
  );
  const candidates: ReviewCandidate[] = [];
  const seen = new Set<string>();

  replaceOutsideProtectedTokens(input, (chunk, chunkOffset) => {
    for (const match of chunk.matchAll(VERB_CANDIDATE_REGEX)) {
      const rawCandidate = match[2] ?? "";
      const candidate = rawCandidate.trim();
      const key = normalizeKey(candidate);
      const classifierType = classifyVerbCandidate(candidate);

      if (!candidate || !CYRILLIC_REGEX.test(candidate) || isKnownPatternPrefix(key, knownPatterns) || seen.has(key)) {
        continue;
      }

      seen.add(key);
      const localOffset = (match.index ?? 0) + (match[1]?.length ?? 0);
      candidates.push({
        ...context,
        candidate,
        classifierType,
        reason: "unrecognized Bulgarian verb-like phrase beginning with 'да'",
        offset: chunkOffset + localOffset,
        context: makeContext(input, chunkOffset + localOffset, candidate.length)
      });
    }

    return chunk;
  });

  return candidates;
}

function findPendingChanges(input: string, compiledPatterns: CompiledPattern[], context: NormalizationContext): PendingChange[] {
  const selected: PendingChange[] = [];

  for (const compiled of compiledPatterns) {
    if (!ruleAppliesToContext(compiled.rule, context)) {
      continue;
    }

    replaceOutsideProtectedTokens(input, (chunk, chunkOffset) => {
      for (const match of chunk.matchAll(compiled.regex)) {
        const prefix = match[1] ?? "";
        const matched = match[2] ?? "";
        const localMatchIndex = match.index ?? 0;
        const start = chunkOffset + localMatchIndex + prefix.length;
        const end = start + matched.length;

        if (overlapsSelectedRange(start, end, selected)) {
          continue;
        }

        selected.push({
          start,
          end,
          original: matched,
          normalized: applyInitialCapital(compiled.rule.canonical, matched),
          compiled
        });
      }

      return chunk;
    });
  }

  return selected.sort((left, right) => left.start - right.start || left.compiled.order - right.compiled.order);
}

function applyPendingChanges(input: string, pendingChanges: PendingChange[]): string {
  let output = "";
  let cursor = 0;

  for (const pending of pendingChanges) {
    output += input.slice(cursor, pending.start);
    output += pending.normalized;
    cursor = pending.end;
  }

  output += input.slice(cursor);
  return output;
}

function toChangeRecord(
  pending: PendingChange,
  context: NormalizationContext,
  paragraphBefore: string,
  paragraphAfter: string
): ChangeRecord {
  return {
    ...context,
    original: pending.original,
    normalized: pending.normalized,
    pattern: pending.compiled.pattern,
    canonical: pending.compiled.rule.canonical,
    category: pending.compiled.rule.category,
    type: pending.compiled.rule.type,
    confidence: pending.compiled.rule.confidence,
    offset: pending.start,
    context: makeContext(paragraphBefore, pending.start, pending.original.length),
    paragraphBefore,
    paragraphAfter
  };
}

function overlapsSelectedRange(start: number, end: number, selected: PendingChange[]): boolean {
  return selected.some((change) => start < change.end && end > change.start);
}

function compilePatterns(rules: NormalizationRule[]): CompiledPattern[] {
  return rules
    .flatMap((rule, ruleIndex) =>
      rule.patterns.filter(isBulgarianText).map((pattern, patternIndex) => ({
        rule,
        pattern,
        order: ruleIndex * 1000 + patternIndex,
        regex: new RegExp(`(^|[^\\p{L}\\p{N}@])(${escapeRegExp(pattern).replace(/\s+/g, "\\s+")})(?=$|[^\\p{L}\\p{N}@])`, "giu")
      }))
    )
    .sort((left, right) => right.pattern.length - left.pattern.length || left.order - right.order);
}

function replaceOutsideProtectedTokens(input: string, transform: (chunk: string, offset: number) => string): string {
  let output = "";
  let lastIndex = 0;

  for (const match of input.matchAll(PROTECTED_TOKEN_REGEX)) {
    const index = match.index ?? 0;
    output += transform(input.slice(lastIndex, index), lastIndex);
    output += match[0];
    lastIndex = index + match[0].length;
  }

  output += transform(input.slice(lastIndex), lastIndex);
  return output;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeKey(value: string): string {
  return value.toLocaleLowerCase("bg-BG").replace(/\s+/g, " ").trim();
}

function isBulgarianText(value: string): boolean {
  return CYRILLIC_REGEX.test(value);
}

function isKnownPatternPrefix(candidateKey: string, knownPatterns: Set<string>): boolean {
  for (const pattern of knownPatterns) {
    if (candidateKey === pattern || candidateKey.startsWith(`${pattern} `)) {
      return true;
    }
  }

  return false;
}

function ruleAppliesToContext(rule: NormalizationRule, context: NormalizationContext): boolean {
  if (!rule.scope || rule.scope.length === 0) {
    return true;
  }

  const source = contextSource(context);
  return source ? rule.scope.includes(source) : true;
}

function contextSource(context: NormalizationContext): RuleScope | undefined {
  if (context.source === "gloss" || context.source === "definition" || context.source === "lexical") {
    return context.source;
  }

  return sectionSource(context.section);
}

function sectionSource(section: string | undefined): RuleScope | undefined {
  if (section === "G") {
    return "gloss";
  }

  if (section === "D") {
    return "definition";
  }

  return undefined;
}

function classifyVerbCandidate(candidate: string): ReviewCandidate["classifierType"] {
  const key = normalizeKey(candidate);
  if (/^да\s+(?:бъде|бъда)\s+\p{Script=Cyrillic}+$/u.test(key)) {
    return "passive";
  }

  if (/^да\s+се\s+\p{Script=Cyrillic}+$/u.test(key) || /^да\s+\p{Script=Cyrillic}+$/u.test(key)) {
    return "simple-infinitive";
  }

  return "complex-phrase";
}

function applyInitialCapital(canonical: string, matched: string): string {
  const first = matched.trimStart().charAt(0);
  if (first && first === first.toLocaleUpperCase("bg-BG") && first !== first.toLocaleLowerCase("bg-BG")) {
    return canonical.charAt(0).toLocaleUpperCase("bg-BG") + canonical.slice(1);
  }

  return canonical;
}

function makeContext(text: string, offset: number, length: number): string {
  const start = Math.max(0, offset - 40);
  const end = Math.min(text.length, offset + length + 40);
  return text.slice(start, end).replace(/\s+/g, " ").trim();
}
