# Roadmap

This roadmap describes intended project direction. It is not a promise that all
features are implemented today. The immediate priority is documentation-first,
then a conservative v0.1 implementation.

## v0.1

The v0.1 goal is a minimal offline DOCX normalizer for Bulgarian verb forms.

Planned and current v0.1 scope:

- read DOCX input;
- preserve marker paragraphs such as `@@000006:G@@` and `@@000006:D@@`;
- normalize Bulgarian verb phrases using explicit JSON rules;
- support active verb rules in `data/verbs.json`;
- support passive verb rules in `data/passive-verbs.json`;
- support reflexive verb rules in `data/reflexive-verbs.json`;
- write a normalized DOCX;
- write `changes.json`;
- write `review-candidates.json`;
- write `report.md`;
- include unit tests for the sample verb rules.

v0.1 should not:

- use AI or external APIs;
- translate text;
- infer missing lemmas;
- rewrite Greek or Hebrew words;
- change Strong's markers;
- delete or reorder entries;
- apply broad terminology changes without explicit rules.

## v0.2

The v0.2 goal is better editorial control and safer rule expansion.

Possible v0.2 work:

- improve DOCX run preservation for changed paragraphs;
- add stricter rule schema validation;
- add duplicate and conflict diagnostics for rule files;
- support dry-run mode;
- support configurable output directories;
- add richer review candidate classification;
- add optional terminology rules with conservative categories;
- add noun normalization behind explicit rules;
- add adjective normalization behind explicit rules;
- add more fixture DOCX files and regression tests;
- add documentation for rule authoring workflow.

v0.2 should still remain offline and deterministic.

## v1.0

The v1.0 goal is a stable editorial normalization tool suitable for repeated
production use on real lexicon documents.

Possible v1.0 requirements:

- stable CLI interface;
- documented rule schema;
- reliable DOCX roundtrip behavior;
- robust marker preservation;
- comprehensive test coverage for verbs, terminology, nouns, and adjectives;
- clear conflict reporting;
- stable JSON report formats;
- large-document performance checks;
- release notes and migration notes for rule file changes.

v1.0 should define what output compatibility means. For example, whether
`changes.json` fields are considered stable API and how future fields may be
added.

## Future Ideas

Future ideas should be evaluated against the offline philosophy before being
accepted.

Potential future directions:

- interactive rule review UI;
- editor workflow for approving review candidates;
- rule packs for specific lexicon sources;
- contextual terminology rules with safe scope constraints;
- import and export of rule review decisions;
- side-by-side DOCX diff generation;
- CSV or SQLite report exports;
- integration with version control for rule changes;
- quality dashboards for unresolved candidates;
- support for additional document formats after DOCX is stable.

AI may assist humans while drafting candidate rules outside the execution path,
but the normalizer itself should remain local, rule-based, transparent, and
repeatable.

## Data and Rule Maturity

As the project grows, the main value will move from the code to the data.

Milestones for rule maturity:

- collect high-frequency verb rules from TBESH;
- expand with TBESG Greek New Testament and LXX-related material;
- expand with TFLSJ/LSJ classical and biblical Greek material;
- split large rule files into thematic files;
- add rule IDs, sources, editorial status, and schema versioning;
- add conflict diagnostics for duplicate patterns;
- maintain review workflows for uncertain cases;
- begin the separate `bg-bible-terminology` layer for nouns, adjectives, names, titles, and theological terms.

A future v1.0 should not only provide a working CLI. It should also include a
stable, reviewed canonical Bulgarian data layer.
