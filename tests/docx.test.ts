import { describe, expect, it } from "vitest";
import { transformDocumentXml } from "../src/docx/writeDocx.js";
import type { NormalizationContext, NormalizationResult } from "../src/rules/types.js";

describe("transformDocumentXml", () => {
  it("preserves marker paragraphs, paragraph order, and empty paragraphs", () => {
    const xml = [
      `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>`,
      paragraph("@@000001:G@@"),
      paragraph(""),
      paragraph("@@CUSTOM@@"),
      paragraph("да загине"),
      `</w:body></w:document>`
    ].join("");

    const result = transformDocumentXml(xml, normalizeTestParagraph);

    expect(result.paragraphCount).toBe(4);
    expect(result.changedParagraphCount).toBe(1);
    expect(result.xml).toContain(paragraph("@@000001:G@@"));
    expect(result.xml).toContain(paragraph(""));
    expect(result.xml).toContain(paragraph("@@CUSTOM@@"));
    expect(result.xml).toContain(paragraph("загивам"));
    expect(result.xml.indexOf("@@000001:G@@")).toBeLessThan(result.xml.indexOf("@@CUSTOM@@"));
    expect(result.xml.indexOf("@@CUSTOM@@")).toBeLessThan(result.xml.indexOf("загивам"));
    expect(result.changes).toEqual([
      expect.objectContaining({ entryId: "000001", section: "G", original: "да загине", normalized: "загивам" })
    ]);
  });

  it("normalizes a phrase split across multiple w:t nodes", () => {
    const xml = [
      `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>`,
      `<w:p><w:r><w:t>@@000001:D@@</w:t></w:r></w:p>`,
      `<w:p><w:r><w:t>да за</w:t></w:r><w:r><w:t>гине</w:t></w:r></w:p>`,
      `</w:body></w:document>`
    ].join("");

    const result = transformDocumentXml(xml, normalizeTestParagraph);

    expect(result.changedParagraphCount).toBe(1);
    expect(result.xml).toContain(`<w:t>загивам</w:t>`);
    expect(result.xml).toContain(`<w:t></w:t>`);
    expect(result.changes[0]).toEqual(
      expect.objectContaining({
        entryId: "000001",
        section: "D",
        original: "да загине",
        normalized: "загивам"
      })
    );
  });
});

function paragraph(text: string): string {
  return `<w:p><w:r><w:t>${text}</w:t></w:r></w:p>`;
}

function normalizeTestParagraph(text: string, context: NormalizationContext): NormalizationResult {
  if (text !== "да загине") {
    return { text, changes: [], reviewCandidates: [] };
  }

  return {
    text: "загивам",
    changes: [
      {
        ...context,
        original: text,
        normalized: "загивам",
        pattern: text,
        canonical: "загивам",
        category: "verb",
        type: "active",
        confidence: 1,
        offset: 0,
        context: text,
        paragraphBefore: text,
        paragraphAfter: "загивам"
      }
    ],
    reviewCandidates: []
  };
}
