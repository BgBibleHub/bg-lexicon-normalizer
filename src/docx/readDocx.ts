import { readFile } from "node:fs/promises";
import JSZip from "jszip";

export interface DocxDocument {
  inputPath: string;
  zip: JSZip;
  documentXml: string;
}

export async function readDocx(inputPath: string): Promise<DocxDocument> {
  const data = await readFile(inputPath);
  const zip = await JSZip.loadAsync(data);
  const documentFile = zip.file("word/document.xml");

  if (!documentFile) {
    throw new Error(`DOCX does not contain word/document.xml: ${inputPath}`);
  }

  return {
    inputPath,
    zip,
    documentXml: await documentFile.async("string")
  };
}
