# Project

`bg-lexicon-normalizer` is an offline TypeScript tool for normalizing already
translated Bulgarian biblical lexicons and dictionaries. It is not a translation
system. It applies explicit local JSON rules to Bulgarian text and produces a
normalized DOCX plus auditable reports.

## Project Goals

The project exists to make Bulgarian lexicon editing repeatable and reviewable.
Its goals are:

- normalize translated Bulgarian glosses and definitions to approved canonical forms;
- preserve dictionary entry markers such as `@@000006:G@@` and `@@000006:D@@`;
- make every automatic change traceable to a JSON rule;
- produce stable output for the same input and rule files;
- keep editorial control in human-owned rule files;
- support low-cost, local processing of large lexicon documents.

The first practical target is verb normalization:

```text
да загине -> загивам
да се отклони -> отклонявам се
да бъде унищожен -> унищожен съм
```

## Scope

Version `0.1.0` is intentionally narrow. It supports:

- reading a `.docx` file;
- extracting visible text from `word/document.xml`;
- preserving `@@...@@` marker paragraphs;
- applying verb normalization rules from local JSON files;
- writing a normalized `.docx` file;
- writing `changes.json` with all replacements;
- writing `review-candidates.json` for unrecognized Bulgarian `да ...` phrases;
- writing `report.md` as a human-readable run summary.

The implemented v0.1 rule files are:

```text
data/verbs.json
data/passive-verbs.json
data/reflexive-verbs.json
```

Terminology, names, places, nouns, and adjectives are part of the broader design,
but v0.1 treats them as planned rule categories rather than aggressive automatic
editing surfaces.

## Non-Goals

The project deliberately does not do the following:

- translate Greek, Hebrew, English, or Bulgarian text;
- call OpenAI, another AI API, or any external inference service;
- infer new lemmas without a rule;
- rewrite Greek or Hebrew words;
- rewrite Strong's markers such as `G622` or `H1234`;
- delete dictionary entries;
- reorder entries;
- apply broad terminology changes without explicit rules;
- silently resolve ambiguous linguistic conflicts.

If a form is not covered by a rule, v0.1 should either leave it unchanged or
report it for review.

## Supported Inputs

The primary input is a Microsoft Word `.docx` file containing translated
Bulgarian lexicon content. The expected document shape is marker-oriented text,
for example:

```text
@@000006:G@@
загивам
@@000006:D@@
1) да загине, да изчезне, да се отклони от пътя, да бъде унищожен
```

The tool reads the DOCX package and processes `word/document.xml`. It does not
require Word, LibreOffice, a browser, or a network connection at runtime.

## Supported Outputs

For an input file named `input.docx`, the default output directory contains:

```text
output/
├── input.normalized.docx
├── changes.json
├── review-candidates.json
└── report.md
```

`input.normalized.docx` is the normalized document. `changes.json` records each
replacement, the rule pattern, the canonical form, the entry context, and a
short text context. `review-candidates.json` records unrecognized verb-like
phrases for human review. `report.md` summarizes the run.

## Offline Philosophy

The normalizer is designed as a deterministic editorial tool. The same input
document and the same rule files should produce the same output every time.

This requires:

- local rule files;
- local DOCX processing;
- stable rule ordering;
- explicit reports;
- no hidden model behavior;
- no remote state.

The project treats normalization as a controlled linguistic operation, not as a
creative generation task.

## Why No AI/API

AI can be useful while humans draft or discuss possible rules, but the execution
path of this tool must remain offline. There are several reasons:

- repeatability: rule-based output can be reproduced exactly;
- auditability: every change points back to a rule;
- cost control: large lexicons can be processed without per-token cost;
- privacy: source documents stay local;
- editorial authority: canonical forms are chosen by maintainers;
- safety: uncertain phrases become review candidates rather than guesses.

The project's boundary is therefore strict: no OpenAI API, no external AI
service, no automatic translation, and no inferred normalization without rules.

## Canonical Bulgarian Lexicon (CBL)

The project maintains a canonical Bulgarian lexical layer, called the
Canonical Bulgarian Lexicon (CBL).

CBL is the editorial layer that records the preferred Bulgarian forms used by
Bible lexicons in this project. A normalized form is not merely a string
replacement; it points to an approved Bulgarian lexical form.

Examples:

```text
да загине -> загивам
да погине -> погивам
да се отклони -> отклонявам се
да бъде унищожен -> унищожен съм
```

CBL is intentionally conservative. Two different source phrases may normalize
to the same canonical form only when an editor has approved that relationship.
For example, `да загине` and `да погине` should not be merged automatically
unless the rule file explicitly says that both patterns belong to the same
canonical form.

The CBL layer will eventually include:

- canonical Bulgarian verb lemmas;
- canonical biblical terminology;
- canonical names;
- canonical place names;
- canonical adjective forms;
- approved alternatives and notes.

In v0.1, only the verb part of this broader CBL idea is implemented.

## Human Editorial Authority

The JSON rule files are the editorial authority.

The software must never invent linguistic rules. Every automatic normalization
must be represented by an explicit rule approved by a human editor. The engine
may detect likely candidates and place them in `review-candidates.json`, but it
must not convert those candidates unless a rule already exists.

This means:

```text
no rule -> no replacement
```

The project is therefore not an autonomous language model. It is an execution
engine for human-approved linguistic decisions.

## Conservative Normalization

Normalization is conservative.

If the engine is not certain because no explicit rule exists, it must leave the
text unchanged and report the phrase for human review when appropriate.

The preferred behavior is:

```text
recognized by rule -> normalize
not recognized by rule -> keep original text
looks suspicious -> add review candidate
```

The tool should never guess based on morphology alone, especially for Bulgarian
reflexive verbs, passive constructions, biblical terminology, and words that can
function as more than one part of speech.

## Rule Provenance and Versioning

Rules should be traceable. A mature rule should be able to record where it came
from and which editor or process approved it.

Recommended rule metadata:

```json
{
  "id": "verb.zagivam.001",
  "canonical": "загивам",
  "patterns": ["да загине"],
  "category": "verb",
  "type": "active",
  "confidence": 1,
  "editorialStatus": "approved",
  "sources": ["TBESH", "TBESG", "TFLSJ"],
  "schemaVersion": "1.0"
}
```

`confidence` is an editorial confidence value, not an AI score. It expresses how
safe the rule is according to maintainers.

Recommended values:

- `1.0` — approved and safe;
- `0.8` — likely correct but should be watched;
- `0.5` — candidate or experimental; should not be enabled by default unless the project explicitly allows it.

In v0.1, existing simple rule objects may remain valid, but the project should
move toward explicit IDs, sources, editorial status, and schema versioning.
