import { describe, expect, it } from "vitest";
import { normalizeDefinition } from "../src/normalizers/normalizeDefinition.js";
import { normalizeGloss } from "../src/normalizers/normalizeGloss.js";
import { createVerbNormalizer } from "../src/normalizers/normalizeVerb.js";
import { detectSourceProfile, parseSourceProfileOptionName, resolveSourceProfile } from "../src/profiles/sourceProfile.js";
import { lehInlineProfile } from "../src/profiles/lehInlineProfile.js";
import { stepMinimalProfile } from "../src/profiles/stepMinimalProfile.js";
import type { NormalizationRule } from "../src/rules/types.js";

const rules: NormalizationRule[] = [
  rule("загивам", ["да загине"], "active"),
  rule("изчезвам", ["да изчезне"], "active"),
  rule("боря се", ["да се боря"], "reflexive")
];
const verbNormalizer = createVerbNormalizer(rules);
const normalizers = {
  gloss: (text: string, context = {}) => normalizeGloss(text, verbNormalizer, context),
  definition: (text: string, context = {}) => normalizeDefinition(text, verbNormalizer, context),
  lexical: (text: string, context = {}) => normalizeDefinition(text, verbNormalizer, context)
};

describe("source profiles", () => {
  it("detects STEP minimal marker documents", () => {
    const profile = detectSourceProfile("<w:t>@@000001:G@@</w:t>");
    expect(profile.name).toBe("step-minimal");
  });

  it("accepts auto as an explicit profile option", () => {
    expect(parseSourceProfileOptionName("auto")).toBe("auto");
    expect(resolveSourceProfile("auto", "<w:t>λόγος N-NSM – да загине</w:t>").name).toBe("leh-inline");
  });

  it("detects LEH inline Greek lemma documents without STEP markers", () => {
    const profile = detectSourceProfile("<w:t>λόγος N-NSM – да загине</w:t>");
    expect(profile.name).toBe("leh-inline");
  });

  it("uses gloss normalization for STEP G sections", () => {
    const result = stepMinimalProfile.normalizeParagraph("да загине", { entryId: "000001", section: "G" }, normalizers);

    expect(result.text).toBe("загивам");
    expect(result.changes[0]).toEqual(expect.objectContaining({ source: "gloss", section: "G" }));
  });

  it("uses definition normalization for STEP D sections", () => {
    const result = stepMinimalProfile.normalizeParagraph("да изчезне", { entryId: "000001", section: "D" }, normalizers);

    expect(result.text).toBe("изчезвам");
    expect(result.changes[0]).toEqual(expect.objectContaining({ source: "definition", section: "D" }));
  });

  it("normalizes only the Bulgarian side of LEH inline paragraphs", () => {
    const input = "λόγος N-NSM – да загине, да изчезне";
    const result = lehInlineProfile.normalizeParagraph(input, { entryId: "LEH1" }, normalizers);

    expect(result.text).toBe("λόγος N-NSM – загивам, изчезвам");
    expect(result.changes.map((change) => [change.original, change.offset])).toEqual([
      ["да загине", 14],
      ["да изчезне", 25]
    ]);
    expect(result.changes[0]?.paragraphBefore).toBe(input);
    expect(result.changes[0]?.paragraphAfter).toBe("λόγος N-NSM – загивам, изчезвам");
  });

  it("leaves LEH Greek lemma and morphology untouched before the delimiter", () => {
    const input = "да загине λόγος – да се боря";
    const result = lehInlineProfile.normalizeParagraph(input, {}, normalizers);

    expect(result.text).toBe("да загине λόγος – боря се");
    expect(result.text.startsWith("да загине λόγος – ")).toBe(true);
    expect(result.changes).toHaveLength(1);
  });
});

function rule(canonical: string, patterns: string[], type: string): NormalizationRule {
  return {
    canonical,
    patterns,
    category: "verb",
    type,
    confidence: 1
  };
}
