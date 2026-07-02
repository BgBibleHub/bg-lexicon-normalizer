import type { NormalizationContext, NormalizationResult } from "../rules/types.js";
import { lehInlineProfile } from "./lehInlineProfile.js";
import { stepMinimalProfile } from "./stepMinimalProfile.js";

export type SourceProfileName = "step-minimal" | "leh-inline";
export type SourceProfileOptionName = SourceProfileName | "auto";

export interface ProfileNormalizers {
  gloss(text: string, context: NormalizationContext): NormalizationResult;
  definition(text: string, context: NormalizationContext): NormalizationResult;
  lexical(text: string, context: NormalizationContext): NormalizationResult;
}

export interface SourceProfile {
  readonly name: SourceProfileName;
  matchesDocumentXml(documentXml: string): boolean;
  normalizeParagraph(
    text: string,
    context: NormalizationContext,
    normalizers: ProfileNormalizers
  ): NormalizationResult;
}

export const SOURCE_PROFILES: SourceProfile[] = [stepMinimalProfile, lehInlineProfile];

export function getSourceProfile(name: SourceProfileName): SourceProfile {
  const profile = SOURCE_PROFILES.find((item) => item.name === name);
  if (!profile) {
    throw new Error(`Unsupported profile: ${name}`);
  }

  return profile;
}

export function parseSourceProfileName(value: string): SourceProfileName {
  if (value === "step-minimal" || value === "leh-inline") {
    return value;
  }

  throw new Error(`Unsupported --profile value: ${value}. Expected step-minimal or leh-inline.`);
}

export function parseSourceProfileOptionName(value: string): SourceProfileOptionName {
  if (value === "auto") {
    return value;
  }

  return parseSourceProfileName(value);
}

export function resolveSourceProfile(value: string | undefined, documentXml: string): SourceProfile {
  const option = value ? parseSourceProfileOptionName(value) : "auto";
  if (option === "auto") {
    return detectSourceProfile(documentXml);
  }

  return getSourceProfile(option);
}

export function detectSourceProfile(documentXml: string): SourceProfile {
  if (stepMinimalProfile.matchesDocumentXml(documentXml)) {
    return stepMinimalProfile;
  }

  if (lehInlineProfile.matchesDocumentXml(documentXml)) {
    return lehInlineProfile;
  }

  return stepMinimalProfile;
}
