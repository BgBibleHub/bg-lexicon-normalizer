import { describe, expect, it } from "vitest";
import { createVerbNormalizer, findVerbReviewCandidates, normalizeVerb } from "../src/normalizers/normalizeVerb.js";
import type { NormalizationRule } from "../src/rules/types.js";

const sampleRules: NormalizationRule[] = [
  rule("загивам", ["да загине", "да погине", "да бъде изгубен"], "active"),
  rule("изчезвам", ["да изчезне"], "active"),
  rule("отклонявам се", ["да се отклони", "да се отклоня"], "reflexive"),
  rule("унищожен съм", ["да бъде унищожен", "да бъда унищожен"], "passive"),
  rule("правя добро", ["да правиш добро"], "active"),
  rule("обичам", ["да обичаш"], "active"),
  rule("купувам", ["да купя"], "active"),
  rule("умирам", ["да умра"], "active"),
  rule("виждам", ["да видя"], "active"),
  rule("казвам", ["да кажа"], "active"),
  rule("вземам", ["да взема"], "active"),
  rule("давам", ["да дам"], "active"),
  rule("радвам се", ["да се радвам"], "reflexive"),
  rule("боря се", ["да се боря"], "reflexive"),
  rule("невеж съм", ["да бъда невеж"], "passive")
];

describe("normalizeVerb", () => {
  it.each([
    ["да загине", "загивам"],
    ["да изчезне", "изчезвам"],
    ["да се отклони", "отклонявам се"],
    ["да бъде унищожен", "унищожен съм"],
    ["да правиш добро", "правя добро"],
    ["да обичаш", "обичам"],
    ["да купя", "купувам"],
    ["да умра", "умирам"],
    ["да видя", "виждам"],
    ["да кажа", "казвам"],
    ["да взема", "вземам"],
    ["да дам", "давам"],
    ["да се радвам", "радвам се"],
    ["да се боря", "боря се"],
    ["да бъда невеж", "невеж съм"]
  ])("normalizes %s -> %s", (input, expected) => {
    const result = normalizeVerb(input, sampleRules);
    expect(result.text).toBe(expected);
    expect(result.changes).toHaveLength(1);
    expect(result.changes[0]?.original).toBe(input);
    expect(result.changes[0]?.normalized).toBe(expected);
  });

  it("preserves marker and Strong tokens", () => {
    const input = "@@000006:D@@ G622 да загине";
    const result = normalizeVerb(input, sampleRules);

    expect(result.text).toBe("@@000006:D@@ G622 загивам");
  });

  it("preserves generic @@ markers", () => {
    const input = "@@CUSTOM-MARKER@@ да загине";
    const result = normalizeVerb(input, sampleRules);

    expect(result.text).toBe("@@CUSTOM-MARKER@@ загивам");
  });

  it("leaves Greek and Hebrew text untouched while normalizing Bulgarian text", () => {
    const input = "λόγος ברא да загине";
    const result = normalizeVerb(input, sampleRules);

    expect(result.text).toBe("λόγος ברא загивам");
  });

  it("does not process text without Cyrillic characters", () => {
    const input = "λόγος ברא G622";
    const result = normalizeVerb(input, sampleRules);

    expect(result).toEqual({ text: input, changes: [], reviewCandidates: [] });
  });

  it("does not report non-Bulgarian words after da as Bulgarian candidates", () => {
    const result = normalizeVerb("да λόγος", sampleRules);

    expect(result.text).toBe("да λόγος");
    expect(result.reviewCandidates).toHaveLength(0);
  });

  it("applies the longest rule before shorter overlapping rules", () => {
    const rules: NormalizationRule[] = [
      rule("кратко", ["да бъде"], "active"),
      rule("унищожен съм", ["да бъде унищожен"], "passive")
    ];
    const result = normalizeVerb("да бъде унищожен", rules);

    expect(result.text).toBe("унищожен съм");
    expect(result.changes).toHaveLength(1);
    expect(result.changes[0]?.pattern).toBe("да бъде унищожен");
  });

  it("reports offsets from the original paragraph after multiple replacements", () => {
    const input = "1) да загине, да изчезне, да се отклони от пътя, да бъде унищожен";
    const result = normalizeVerb(input, sampleRules);

    expect(result.text).toBe("1) загивам, изчезвам, отклонявам се от пътя, унищожен съм");
    expect(result.changes.map((change) => [change.original, change.offset])).toEqual([
      ["да загине", 3],
      ["да изчезне", 14],
      ["да се отклони", 26],
      ["да бъде унищожен", 49]
    ]);
  });

  it("extracts change context from paragraphBefore, not partially normalized text", () => {
    const input = "1) да загине, да изчезне, да бъде унищожен";
    const result = normalizeVerb(input, sampleRules);
    const firstChange = result.changes[0];

    expect(firstChange?.paragraphBefore).toBe(input);
    expect(firstChange?.paragraphAfter).toBe("1) загивам, изчезвам, унищожен съм");
    expect(firstChange?.context).toContain("да изчезне");
    expect(firstChange?.context).not.toContain("изчезвам");
  });

  it("reports unknown da-phrase candidates after known replacements", () => {
    const input = "да загине, да прославиш Бога";
    const result = normalizeVerb(input, sampleRules);

    expect(result.text).toBe("загивам, да прославиш Бога");
    expect(result.reviewCandidates).toEqual([
      expect.objectContaining({ candidate: "да прославиш Бога", offset: 9 })
    ]);
  });

  it("can reuse compiled verb patterns across paragraphs", () => {
    const normalizer = createVerbNormalizer(sampleRules);

    expect(normalizer.normalize("да загине").text).toBe("загивам");
    expect(normalizer.normalize("да се боря").text).toBe("боря се");
  });

  it("does not replace inside larger words", () => {
    const result = normalizeVerb("предада дам", sampleRules);
    expect(result.text).toBe("предада дам");
    expect(result.changes).toHaveLength(0);
  });

  it("reports unknown Bulgarian da-phrase candidates without changing them", () => {
    const input = "да прославиш Бога";
    const result = normalizeVerb(input, sampleRules);

    expect(result.text).toBe(input);
    expect(result.reviewCandidates).toEqual([
      expect.objectContaining({ candidate: "да прославиш Бога", classifierType: "complex-phrase" })
    ]);
  });

  it("classifies simple, passive, and complex unknown candidates", () => {
    const result = normalizeVerb("да летя; да бъде готов; да прославиш Бога", sampleRules);

    expect(result.reviewCandidates.map((candidate) => [candidate.candidate, candidate.classifierType])).toEqual([
      ["да летя", "simple-infinitive"],
      ["да бъде готов", "passive"],
      ["да прославиш Бога", "complex-phrase"]
    ]);
  });

  it("applies scoped rules only in matching contexts", () => {
    const rules: NormalizationRule[] = [
      { ...rule("летя", ["да летя"], "active"), scope: ["gloss"] }
    ];

    expect(normalizeVerb("да летя", rules, { source: "gloss" }).text).toBe("летя");
    expect(normalizeVerb("да летя", rules, { source: "definition" }).text).toBe("да летя");
    expect(normalizeVerb("да летя", rules, { source: "definition" }).reviewCandidates[0]).toEqual(
      expect.objectContaining({ candidate: "да летя", classifierType: "simple-infinitive" })
    );
  });

  it("does not report candidates that begin with a known pattern", () => {
    const candidates = findVerbReviewCandidates("да се отклони от пътя", sampleRules);
    expect(candidates).toHaveLength(0);
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
