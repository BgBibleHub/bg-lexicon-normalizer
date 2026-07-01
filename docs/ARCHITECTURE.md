# Architecture

`bg-lexicon-normalizer` is organized as a small CLI-driven TypeScript package.
The architecture is intentionally plain: read local files, load local rules,
normalize text, write local outputs, and report what changed.

## Module Overview

The main modules are:

- `src/cli.ts`: command-line entry point, argument parsing, output paths, and run orchestration;
- `src/index.ts`: public exports for library-style use;
- `src/docx/readDocx.ts`: reads the DOCX zip package and extracts `word/document.xml`;
- `src/docx/writeDocx.ts`: transforms paragraph text and writes the updated DOCX package;
- `src/rules/types.ts`: shared TypeScript types for rules, changes, and review candidates;
- `src/rules/loadRules.ts`: loads and validates JSON rule files;
- `src/normalizers/normalizeVerb.ts`: applies verb patterns and finds review candidates;
- `src/normalizers/normalizeGloss.ts`: gloss-level normalization entry point;
- `src/normalizers/normalizeDefinition.ts`: definition-level normalization entry point;
- `src/normalizers/normalizeTerminology.ts`: placeholder for conservative future terminology rules;
- `src/reports/generateReport.ts`: creates the Markdown run report.

The project does not contain a server, database, queue, model runtime, browser
automation layer, or external API client.

## Directory Structure

```text
bg-lexicon-normalizer/
├── README.md
├── LICENSE
├── package.json
├── tsconfig.json
├── docs/
│   ├── PROJECT.md
│   ├── ARCHITECTURE.md
│   ├── CANONICAL_BULGARIAN.md
│   ├── RULE_ENGINE.md
│   ├── ROADMAP.md
│   ├── VERB_NORMALIZATION.md
│   └── TERMINOLOGY.md
├── src/
│   ├── index.ts
│   ├── cli.ts
│   ├── docx/
│   │   ├── readDocx.ts
│   │   └── writeDocx.ts
│   ├── normalizers/
│   │   ├── normalizeGloss.ts
│   │   ├── normalizeDefinition.ts
│   │   ├── normalizeVerb.ts
│   │   └── normalizeTerminology.ts
│   ├── rules/
│   │   ├── loadRules.ts
│   │   └── types.ts
│   └── reports/
│       └── generateReport.ts
├── data/
│   ├── verbs.json
│   ├── passive-verbs.json
│   ├── reflexive-verbs.json
│   ├── terminology.json
│   ├── names.json
│   ├── places.json
│   └── review-candidates.json
├── examples/
│   └── stepbible-sample.docx
├── output/
└── tests/
    ├── normalizeVerb.test.ts
    └── normalizeGloss.test.ts
```

## Data Flow

The high-level data flow is:

```text
input.docx
  -> read DOCX zip
  -> load word/document.xml
  -> load JSON rules
  -> scan paragraphs
  -> preserve marker context
  -> normalize Bulgarian text
  -> collect changes
  -> collect review candidates
  -> write normalized DOCX
  -> write JSON reports
  -> write Markdown report
```

Rule files and source documents are inputs. The normalized DOCX and report files
are outputs. No network resources are part of the pipeline.

## Processing Pipeline

The v0.1 processing pipeline is:

1. Parse CLI arguments.
2. Resolve the input DOCX path and output directory.
3. Load verb rules from JSON.
4. Open the DOCX as a zip package with `jszip`.
5. Read `word/document.xml`.
6. Iterate through Word paragraphs, represented as `w:p` nodes.
7. Concatenate visible paragraph text from `w:t` text nodes.
8. Detect marker paragraphs such as `@@000006:G@@` and `@@000006:D@@`.
9. Store marker-derived entry context for later changes.
10. Apply normalizers to non-marker paragraph text.
11. Replace changed paragraph text in the DOCX XML.
12. Generate the normalized DOCX package.
13. Write `changes.json`, `review-candidates.json`, and `report.md`.

## Marker Context

Marker paragraphs define the current dictionary entry and section:

```text
@@000006:G@@ -> entryId 000006, section G
@@000006:D@@ -> entryId 000006, section D
```

The current context is attached to change records and review candidates. The
markers themselves are preserved and should not be normalized.

## DOCX Tradeoff

DOCX documents often split a single visible phrase across multiple XML text
runs. v0.1 normalizes at paragraph level so that phrase rules still work when a
phrase crosses run boundaries.

When a paragraph changes, v0.1 writes the normalized visible text into the first
`w:t` node and clears remaining text nodes in that paragraph. This preserves the
document order and marker paragraphs, but it does not promise perfect run-level
formatting preservation for changed paragraphs.

## Runtime Boundaries

The runtime boundary is deliberately small:

- local filesystem input;
- local JSON rules;
- local DOCX zip manipulation;
- local output files.

There is no HTTP client in the normalization path, no model client, and no
dependency on a remote database.

## Canonical Data Layer

The project should be understood as having two layers:

```text
normalization engine
  uses
canonical data layer
```

The normalization engine reads documents and applies rules. The canonical data
layer contains the human-approved linguistic decisions: verb lemmas,
terminology, names, places, and future rule packs.

The canonical data layer is more important than the implementation. The code can
be replaced; the editorial data is the long-term asset.

Recommended future data layout:

```text
data/
├── verbs/
│   ├── active.json
│   ├── passive.json
│   ├── reflexive.json
│   ├── irregular.json
│   └── phrasal.json
├── terminology/
│   ├── theological.json
│   ├── nouns.json
│   ├── adjectives.json
│   └── titles.json
├── names/
│   ├── people.json
│   └── divine-names.json
├── places/
│   └── places.json
└── schemas/
    └── rule.schema.json
```

For v0.1, the flat files in `data/` are acceptable. As the project grows, rules
should be split into smaller thematic files to keep review practical.
