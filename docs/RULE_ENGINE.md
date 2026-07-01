# Rule Engine

The rule engine is the deterministic core of `bg-lexicon-normalizer`. It loads
local JSON rules, applies them to Bulgarian text, records every change, and
reports phrases that need human review. It does not translate and does not call
AI services.

## Rule Loading

v0.1 loads verb rules from three files:

```text
data/verbs.json
data/passive-verbs.json
data/reflexive-verbs.json
```

Each file contains an array of rule objects:

```json
{
  "canonical": "отклонявам се",
  "patterns": ["да се отклони", "да се отклоня"],
  "category": "verb",
  "type": "reflexive",
  "confidence": 1
}
```

The loader should validate that each rule has:

- a non-empty `canonical` string;
- at least one non-empty `patterns` entry;
- a non-empty `category` string;
- optional metadata such as `type`, `confidence`, and `notes`.

Invalid rule files should fail loudly. Silent rule loading errors would make the
normalization output misleading.

## Rule Priority

Rules are applied by pattern length, from longest to shortest. This prevents a
short pattern from consuming part of a longer phrase.

Example priority:

```text
да бъде унищожен
да бъде
```

The longer pattern must run first. In v0.1, the rule engine compiles every
pattern into a bounded regular expression and sorts compiled patterns by source
pattern length.

## Normalization Order

The v0.1 order is:

1. Read DOCX content.
2. Track marker context such as `@@000006:D@@`.
3. Apply verb rules to paragraph text.
4. Preserve protected tokens.
5. Collect change records.
6. Detect remaining review candidates.
7. Write outputs.

Within verb rules, practical ordering is:

1. passive phrase rules when their patterns are longest;
2. reflexive phrase rules when their patterns are longest;
3. active phrase rules;
4. review candidate detection after replacements.

This ordering is an implementation detail of length-based priority, not a
semantic claim that passive forms are always more important.

## Protected Tokens

The rule engine must not change protected structural tokens:

```text
@@000006:G@@
@@000006:D@@
G622
H1234
```

Protected tokens represent lexicon structure or external lexical identifiers.
They are not Bulgarian prose and should not be normalized.

## Conflict Resolution

Conflicts happen when more than one rule could apply to the same source text.
The policy is:

- exact explicit rules win over broad future rules;
- longer patterns win over shorter patterns;
- duplicate patterns should be deduplicated during rule loading;
- ambiguous patterns should be removed or rewritten by maintainers;
- uncertain text should become a review candidate, not a guessed replacement.

Example conflict risk:

```text
да се отклони
да се отклони от пътя
```

If both are valid, the longer phrase should run first. If they imply different
canonical meanings, the rule set should be reviewed before use.

## Reporting

The engine emits three report surfaces.

`changes.json` records automatic replacements:

```json
{
  "entryId": "000006",
  "section": "D",
  "original": "да загине",
  "normalized": "загивам",
  "pattern": "да загине",
  "canonical": "загивам",
  "category": "verb",
  "type": "active",
  "confidence": 1
}
```

`review-candidates.json` records unrecognized verb-like phrases that remain in
the text and may need new rules.

`report.md` summarizes the run in a human-readable format, including the input,
output, number of changed paragraphs, number of changes, and number of review
candidates.

## Determinism

The rule engine is deterministic by design:

- rules are local files;
- no network services are called;
- no AI model is called;
- rule priority is stable;
- output files record the changes;
- review candidates are reported instead of guessed.

This makes the tool suitable for editorial review, repeatable batch processing,
and version-controlled rule maintenance.

## Rule Object Metadata

The minimum v0.1 rule shape is intentionally simple, but the preferred long-term
shape should support provenance and review.

Minimum accepted shape:

```json
{
  "canonical": "отклонявам се",
  "patterns": ["да се отклони", "да се отклоня"],
  "category": "verb",
  "type": "reflexive",
  "confidence": 1
}
```

Preferred mature shape:

```json
{
  "id": "verb.otklonyavam-se.001",
  "schemaVersion": "1.0",
  "canonical": "отклонявам се",
  "patterns": ["да се отклони", "да се отклоня"],
  "category": "verb",
  "type": "reflexive",
  "confidence": 1,
  "editorialStatus": "approved",
  "sources": ["TBESH", "TBESG", "TFLSJ"],
  "notes": "Canonical reflexive verb form. Keep се after the verb."
}
```

The engine should tolerate the minimum shape for v0.1 but should report missing
recommended metadata in future validation modes.

## Conservative Failure Mode

The engine should fail safely.

Safe behavior:

- missing rule -> no replacement;
- invalid rule file -> stop with clear error;
- duplicate pattern with same canonical -> deduplicate or warn;
- duplicate pattern with different canonical -> error or report conflict;
- low-confidence rule -> do not apply unless explicitly enabled;
- unknown candidate -> report for review.

Unsafe behavior:

- guessing a lemma from morphology;
- rewriting all `да ...` phrases mechanically;
- rewriting all passive-looking phrases mechanically;
- converting terminology without context or explicit rule.

When in doubt, the correct output is unchanged text plus a review candidate.
