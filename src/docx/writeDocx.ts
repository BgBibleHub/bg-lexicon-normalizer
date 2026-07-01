import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { DocxDocument } from "./readDocx.js";
import type { DocxWriteResult, NormalizationContext, NormalizationResult } from "../rules/types.js";

export type ParagraphTransform = (text: string, context: NormalizationContext) => NormalizationResult;

interface MarkerState {
  entryId?: string;
  section?: string;
}

const PARAGRAPH_REGEX = /<w:p\b[\s\S]*?<\/w:p>/gu;
const TEXT_NODE_REGEX = /<w:t\b([^>]*)>([\s\S]*?)<\/w:t>/gu;
const ANY_MARKER_REGEX = /^@@[^@\r\n]*@@$/u;
const ENTRY_MARKER_REGEX = /^@@(\d{6}):([A-Z])@@$/u;

export async function writeDocx(
  document: DocxDocument,
  outputPath: string,
  transform: ParagraphTransform
): Promise<DocxWriteResult> {
  const result = transformDocumentXml(document.documentXml, transform);
  document.zip.file("word/document.xml", result.xml);

  await mkdir(path.dirname(outputPath), { recursive: true });
  const buffer = await document.zip.generateAsync({ type: "nodebuffer" });
  await writeFile(outputPath, buffer);

  return {
    changes: result.changes,
    reviewCandidates: result.reviewCandidates,
    paragraphCount: result.paragraphCount,
    changedParagraphCount: result.changedParagraphCount
  };
}

export function transformDocumentXml(documentXml: string, transform: ParagraphTransform): DocxWriteResult & { xml: string } {
  const state: MarkerState = {};
  let paragraphCount = 0;
  let changedParagraphCount = 0;
  const changes: DocxWriteResult["changes"] = [];
  const reviewCandidates: DocxWriteResult["reviewCandidates"] = [];

  const xml = documentXml.replace(PARAGRAPH_REGEX, (paragraphXml) => {
    paragraphCount += 1;
    const paragraphText = extractParagraphText(paragraphXml);

    if (paragraphText === "") {
      return paragraphXml;
    }

    const trimmedParagraphText = paragraphText.trim();
    const entryMarker = trimmedParagraphText.match(ENTRY_MARKER_REGEX);
    if (entryMarker) {
      state.entryId = entryMarker[1];
      state.section = entryMarker[2];
      return paragraphXml;
    }

    if (ANY_MARKER_REGEX.test(trimmedParagraphText)) {
      return paragraphXml;
    }

    const normalized = transform(paragraphText, {
      entryId: state.entryId,
      section: state.section,
      source: sectionName(state.section)
    });

    changes.push(...normalized.changes);
    reviewCandidates.push(...normalized.reviewCandidates);

    if (normalized.text === paragraphText) {
      return paragraphXml;
    }

    changedParagraphCount += 1;
    return replaceParagraphText(paragraphXml, normalized.text);
  });

  return {
    xml,
    changes,
    reviewCandidates,
    paragraphCount,
    changedParagraphCount
  };
}

function extractParagraphText(paragraphXml: string): string {
  let text = "";

  for (const match of paragraphXml.matchAll(TEXT_NODE_REGEX)) {
    text += decodeXmlText(match[2] ?? "");
  }

  return text;
}

function replaceParagraphText(paragraphXml: string, text: string): string {
  let wroteText = false;

  return paragraphXml.replace(TEXT_NODE_REGEX, (_full, attributes: string) => {
    if (!wroteText) {
      wroteText = true;
      return `<w:t${ensureSpacePreserve(attributes, text)}>${encodeXmlText(text)}</w:t>`;
    }

    return `<w:t${attributes}></w:t>`;
  });
}

function ensureSpacePreserve(attributes: string, text: string): string {
  if (!/^\s|\s$/u.test(text) || /xml:space=/u.test(attributes)) {
    return attributes;
  }

  return `${attributes} xml:space="preserve"`;
}

function decodeXmlText(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function encodeXmlText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function sectionName(section: string | undefined): string {
  if (section === "G") {
    return "gloss";
  }

  if (section === "D") {
    return "definition";
  }

  return "docx";
}
