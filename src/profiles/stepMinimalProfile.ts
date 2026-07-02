import type { NormalizationContext, NormalizationResult } from "../rules/types.js";
import type { ProfileNormalizers, SourceProfile } from "./sourceProfile.js";

const STEP_MARKER_REGEX = /@@[^@\r\n]*:[GD]@@/u;

export const stepMinimalProfile: SourceProfile = {
  name: "step-minimal",

  matchesDocumentXml(documentXml: string): boolean {
    return STEP_MARKER_REGEX.test(documentXml);
  },

  normalizeParagraph(
    text: string,
    context: NormalizationContext,
    normalizers: ProfileNormalizers
  ): NormalizationResult {
    if (context.section === "G") {
      return normalizers.gloss(text, { ...context, source: "gloss" });
    }

    if (context.section === "D") {
      return normalizers.definition(text, { ...context, source: "definition" });
    }

    return normalizers.definition(text, { ...context, source: context.source ?? "docx" });
  }
};
