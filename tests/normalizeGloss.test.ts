import { describe, expect, it } from "vitest";
import { normalizeGloss } from "../src/normalizers/normalizeGloss.js";
import type { NormalizationRule } from "../src/rules/types.js";

const rules: NormalizationRule[] = [
  {
    canonical: "загивам",
    patterns: ["да загине"],
    category: "verb",
    type: "active",
    confidence: 1
  },
  {
    canonical: "изчезвам",
    patterns: ["да изчезне"],
    category: "verb",
    type: "active",
    confidence: 1
  },
  {
    canonical: "отклонявам се",
    patterns: ["да се отклони"],
    category: "verb",
    type: "reflexive",
    confidence: 1
  },
  {
    canonical: "унищожен съм",
    patterns: ["да бъде унищожен"],
    category: "verb",
    type: "passive",
    confidence: 1
  }
];

describe("normalizeGloss", () => {
  it("normalizes the sample definition phrase list", () => {
    const input = "1) да загине, да изчезне, да се отклони от пътя, да бъде унищожен";
    const result = normalizeGloss(input, rules, { entryId: "000006", section: "D" });

    expect(result.text).toBe("1) загивам, изчезвам, отклонявам се от пътя, унищожен съм");
    expect(result.changes).toHaveLength(4);
    expect(result.reviewCandidates).toHaveLength(0);
  });

  it("preserves @@ markers while normalizing surrounding Bulgarian text", () => {
    const input = "@@000006:D@@\nда загине";
    const result = normalizeGloss(input, rules);

    expect(result.text).toBe("@@000006:D@@\nзагивам");
  });
});
