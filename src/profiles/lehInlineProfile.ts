import type { ChangeRecord, NormalizationContext, NormalizationResult, ReviewCandidate } from "../rules/types.js";
import type { ProfileNormalizers, SourceProfile } from "./sourceProfile.js";

const INLINE_DELIMITER = " – ";
const GREEK_REGEX = /\p{Script=Greek}/u;

export const lehInlineProfile: SourceProfile = {
  name: "leh-inline",

  matchesDocumentXml(documentXml: string): boolean {
    return GREEK_REGEX.test(documentXml) && documentXml.includes(INLINE_DELIMITER);
  },

  normalizeParagraph(
    text: string,
    context: NormalizationContext,
    normalizers: ProfileNormalizers
  ): NormalizationResult {
    const delimiterIndex = text.indexOf(INLINE_DELIMITER);
    if (delimiterIndex === -1) {
      return { text, changes: [], reviewCandidates: [] };
    }

    const splitOffset = delimiterIndex + INLINE_DELIMITER.length;
    const prefix = text.slice(0, splitOffset);
    const bulgarianSide = text.slice(splitOffset);
    const normalized = normalizers.lexical(bulgarianSide, { ...context, source: "lexical" });
    const normalizedText = `${prefix}${normalized.text}`;

    return {
      text: normalizedText,
      changes: normalized.changes.map((change) => shiftChange(change, splitOffset, text, normalizedText)),
      reviewCandidates: normalized.reviewCandidates.map((candidate) =>
        shiftReviewCandidate(candidate, splitOffset, normalizedText)
      )
    };
  }
};

function shiftChange(
  change: ChangeRecord,
  splitOffset: number,
  paragraphBefore: string,
  paragraphAfter: string
): ChangeRecord {
  const offset = splitOffset + change.offset;

  return {
    ...change,
    offset,
    context: makeContext(paragraphBefore, offset, change.original.length),
    paragraphBefore,
    paragraphAfter
  };
}

function shiftReviewCandidate(
  candidate: ReviewCandidate,
  splitOffset: number,
  paragraphAfter: string
): ReviewCandidate {
  const offset = splitOffset + candidate.offset;

  return {
    ...candidate,
    offset,
    context: makeContext(paragraphAfter, offset, candidate.candidate.length)
  };
}

function makeContext(text: string, offset: number, length: number): string {
  const start = Math.max(0, offset - 40);
  const end = Math.min(text.length, offset + length + 40);
  return text.slice(start, end).replace(/\s+/g, " ").trim();
}

