# Curation Interface

The v0.3 curation interface is planned as an offline editorial workflow for
turning `review-candidates.json` into approved JSON normalization rules.

It is not an AI feature. It must not call OpenAI, external APIs, translation
services, or remote databases. The curation process should be local,
repeatable, transparent, and fully controlled by human editors.

## Goal

The goal is to help editors review high-frequency verb candidates and promote
approved items into rule files:

```text
output/review-candidates.json
  -> editorial review
  -> approved JSON rules
  -> data/verbs.json
  -> data/reflexive-verbs.json
  -> data/passive-verbs.json
```

The interface should reduce mechanical editing work, but it should not decide
canonical forms automatically. Editors remain responsible for every approved
rule.

## Command

Planned CLI command:

```bash
npm run curate -- output/review-candidates.json
```

The command opens an interactive terminal workflow. It reads candidates and
existing rules from local files, then writes approved rules and a curation log.

## Input

Primary input:

```text
output/review-candidates.json
```

Candidate records should include:

- `candidate`;
- `classifierType`;
- `frequency`;
- `context`;
- `entryId`, when available;
- `section`, when available;
- `source`, when available.

The curation interface should also read the existing rule files to avoid
duplicates:

```text
data/verbs.json
data/reflexive-verbs.json
data/passive-verbs.json
```

## Candidate Ordering

Candidates should be grouped and sorted by descending frequency. The highest
frequency candidates should appear first because they offer the largest impact
for editorial review.

Recommended secondary ordering:

1. `classifierType`;
2. normalized candidate text;
3. first observed entry id or source location.

The interface should show one candidate group at a time.

## Candidate Display

For each candidate, show:

- candidate text;
- frequency;
- classifier type;
- source sections, when available;
- several examples or contexts;
- whether similar or duplicate rules already exist;
- suggested target file based on classifier type.

Example display:

```text
Candidate: да се покланям
Type: simple-infinitive
Frequency: 17
Sections: G, D

Examples:
1. 000086 G: да се покланям
2. 002314 D: ... да се покланям пред ...
3. LEH lexical: προσκυνέω – да се покланям ...
```

Context examples must be taken from the local `review-candidates.json` file.
They must not be generated or expanded by AI.

## Actions

The interactive workflow should support these actions:

- accept with suggested canonical;
- edit canonical;
- mark as passive;
- mark as reflexive;
- skip;
- reject;
- quit and save progress.

### Accept With Suggested Canonical

The interface may offer a mechanical suggestion only when it is transparent,
such as removing `да` from an already obvious canonical-looking form. The editor
must explicitly accept it before any rule is written.

No suggestion should be treated as authoritative.

### Edit Canonical

Editors must be able to type the canonical form manually. This is the main path
for accurate lexical normalization.

### Mark As Passive

Marking as passive should set:

```json
"type": "passive"
```

and target:

```text
data/passive-verbs.json
```

### Mark As Reflexive

Marking as reflexive should set:

```json
"type": "reflexive"
```

and target:

```text
data/reflexive-verbs.json
```

### Skip

Skip leaves the candidate unresolved and available for future curation.

### Reject

Reject records that the candidate should not become a rule, usually because it
is explanatory prose, a full sentence, a quotation, or a false positive.

### Quit And Save Progress

Quit should save all accepted, skipped, and rejected decisions made so far. A
long curation session must be recoverable.

## Rule Output

Approved rules should be appended to the appropriate local JSON file:

```text
data/verbs.json
data/reflexive-verbs.json
data/passive-verbs.json
```

Rules must preserve the current schema fields:

```json
{
  "canonical": "покланям се",
  "patterns": ["да се покланям"],
  "category": "verb",
  "type": "reflexive",
  "scope": ["gloss", "definition", "lexical"],
  "status": "approved",
  "sources": ["curation"],
  "confidence": 1
}
```

Required fields for curated verb rules:

- `canonical`;
- `patterns`;
- `category`;
- `type`;
- `confidence`.

Recommended fields:

- `scope`;
- `status`;
- `sources`.

## Duplicate Avoidance

Before writing a rule, the interface must check all verb rule files for an
existing equivalent pattern.

Duplicate detection should normalize:

- case;
- leading and trailing whitespace;
- repeated internal whitespace.

If a pattern already exists with the same canonical form, the interface should
not add a duplicate.

If a pattern already exists with a different canonical form, the interface
should stop and show a conflict that requires editor review.

## Curation Log

Every curation session should create or update:

```text
output/curation-log.json
```

The log should record:

- timestamp;
- input candidate file;
- candidate text;
- classifier type;
- frequency;
- action taken;
- canonical form, when accepted;
- target rule file, when accepted;
- rule object written, when accepted;
- duplicate or conflict status;
- sample contexts used for review.

Rejected and skipped candidates should also be logged so that editorial work is
not lost.

## Safety Rules

The curation interface must never modify DOCX files.

It may write only:

- approved rule JSON files;
- `output/curation-log.json`;
- optional temporary progress files.

It must not normalize text during curation. Normalization remains a separate
batch command.

## Non-Goals

v0.3 curation should not:

- add terminology normalization;
- infer canonical forms with AI;
- translate Greek, Hebrew, English, or Bulgarian text;
- rewrite DOCX files;
- silently overwrite existing conflicting rules;
- auto-approve complex phrase candidates.

Complex phrase candidates should require explicit editorial judgment because
they may be objects, complements, full clauses, quotations, or explanatory
prose.

