import { mkdtemp, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { ALL_RULE_FILES, loadAllRules, RuleValidationError } from "../src/rules/loadRules.js";

describe("loadAllRules", () => {
  it("loads all JSON rule files and returns verb rules separately", async () => {
    const dataDir = await makeRuleDir({
      "verbs.json": [rule("загивам", ["да загине"], "verb", "active")],
      "passive-verbs.json": [rule("унищожен съм", ["да бъде унищожен"], "verb", "passive")],
      "reflexive-verbs.json": [rule("радвам се", ["да се радвам"], "verb", "reflexive")],
      "terminology.json": [rule("завет", ["договор"], "theological-term")],
      "names.json": [],
      "places.json": []
    });

    const loaded = await loadAllRules(dataDir);

    expect(loaded.ruleFiles).toEqual([...ALL_RULE_FILES]);
    expect(loaded.verbRules.map((item) => item.canonical)).toEqual(["загивам", "унищожен съм", "радвам се"]);
    expect(loaded.terminologyRules).toEqual([expect.objectContaining({ canonical: "завет" })]);
    expect(loaded.nameRules).toEqual([]);
    expect(loaded.placeRules).toEqual([]);
  });

  it("reports all invalid rule entries together", async () => {
    const dataDir = await makeRuleDir({
      "verbs.json": [
        { canonical: "", patterns: ["да загине"], category: "verb" },
        { canonical: "виждам", patterns: [""], category: "verb", type: "active", confidence: 2 }
      ],
      "passive-verbs.json": [{ canonical: "унищожен съм", patterns: ["да бъде унищожен"], category: "term", type: "middle" }],
      "reflexive-verbs.json": [],
      "terminology.json": { canonical: "завет" },
      "names.json": [],
      "places.json": []
    });

    await expect(loadAllRules(dataDir)).rejects.toThrow(RuleValidationError);

    try {
      await loadAllRules(dataDir);
    } catch (error) {
      expect(error).toBeInstanceOf(RuleValidationError);
      const validationError = error as RuleValidationError;
      expect(validationError.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ index: 0, field: "canonical" }),
          expect.objectContaining({ index: 1, field: "patterns[0]" }),
          expect.objectContaining({ index: 1, field: "confidence" }),
          expect.objectContaining({ index: 0, field: "category" }),
          expect.objectContaining({ index: 0, field: "type" }),
          expect.objectContaining({ message: "rule file must contain a JSON array" })
        ])
      );
    }
  });

  it("accepts optional rule metadata without requiring it in older rules", async () => {
    const dataDir = await makeRuleDir({
      "verbs.json": [
        {
          ...rule("загивам", ["да загине"], "verb", "active"),
          status: "approved",
          sources: ["manual-review"],
          schemaVersion: 1,
          scope: ["gloss", "definition"]
        }
      ],
      "passive-verbs.json": [rule("унищожен съм", ["да бъде унищожен"], "verb", "passive")],
      "reflexive-verbs.json": [rule("радвам се", ["да се радвам"], "verb", "reflexive")],
      "terminology.json": [rule("завет", ["договор"], "theological-term")],
      "names.json": [],
      "places.json": []
    });

    const loaded = await loadAllRules(dataDir);

    expect(loaded.verbRules[0]).toEqual(
      expect.objectContaining({
        canonical: "загивам",
        status: "approved",
        sources: ["manual-review"],
        schemaVersion: 1,
        scope: ["gloss", "definition"]
      })
    );
    expect(loaded.terminologyRules[0]).toEqual(expect.objectContaining({ canonical: "завет" }));
  });
});

async function makeRuleDir(files: Record<string, unknown>): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "bg-lexicon-rules-"));

  await Promise.all(
    Object.entries(files).map(([fileName, value]) =>
      writeFile(path.join(dir, fileName), `${JSON.stringify(value, null, 2)}\n`, "utf8")
    )
  );

  return dir;
}

function rule(canonical: string, patterns: string[], category: string, type?: string): Record<string, unknown> {
  return {
    canonical,
    patterns,
    category,
    ...(type ? { type } : {}),
    confidence: 1
  };
}
