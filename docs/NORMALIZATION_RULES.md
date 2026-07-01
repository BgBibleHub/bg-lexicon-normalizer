# Normalization Rules

This document records editorial normalization decisions in human-readable form.
It is not a machine rule file. Machine-readable rules live in `data/`.

Use this document when discussing whether a new rule should be added.

## Core Policy

The normalizer is conservative:

```text
if no explicit rule exists, do not change the text
```

The project does not translate, does not use AI/API during execution, and does
not invent new Bulgarian lemmas automatically.

## Verb Gloss Rules

In short gloss fields, Bulgarian verbs should normally appear in canonical
lexical form, not as `да ...` phrases.

| Source phrase | Canonical form | Rule type | Notes |
|---|---|---|---|
| да загине | загивам | active | Dictionary-style imperfective form. |
| да изчезне | изчезвам | active | Dictionary-style imperfective form. |
| да умра | умирам | active | Irregular aspectual pair. |
| да видя | виждам | active | Irregular aspectual pair. |
| да кажа | казвам | active | Irregular aspectual pair. |
| да купя | купувам | active | Imperfective canonical form. |
| да обичаш | обичам | active | Normalize person/infinitive-like DeepL phrase. |
| да се отклони | отклонявам се | reflexive | Keep `се` after the verb. |
| да се радвам | радвам се | reflexive | Keep `се` after the verb. |
| да се боря | боря се | reflexive | Keep `се` after the verb. |
| да бъде унищожен | унищожен съм | passive | Passive/adjectival meaning. |
| да бъда невеж | невеж съм | passive/state | State-like passive construction. |

## Passive Rules

Passive rules must be explicit. Do not create a broad automatic rule that
rewrites every `да бъде ...` phrase.

Good:

```json
{
  "canonical": "унищожен съм",
  "patterns": ["да бъде унищожен", "да бъда унищожен"],
  "type": "passive"
}
```

Risky:

```text
да бъде X -> X съм
```

The risky pattern is not allowed as a general rule because Bulgarian passive and
adjectival constructions are context-sensitive.

## Reflexive Rules

Reflexive verbs should not be normalized by simply moving `се`. The canonical
form must be approved explicitly.

Examples:

```text
да се отклони -> отклонявам се
да се бои -> боя се
да се покае -> разкайвам се
```

## Noun and Terminology Rules

Nouns, adjectives, names, and theological terms belong primarily to the future
`bg-bible-terminology` layer. They should not be aggressively normalized in
v0.1.

Possible future examples:

| Source phrase | Canonical form | Category | Notes |
|---|---|---|---|
| договор | завет | theological-term | Only in covenant contexts. |
| съюз | завет | theological-term | Context-sensitive. |
| справедливост | праведност | theological-term | Requires biblical context. |
| първожрец | първосвещеник | title | Preferred biblical title. |

## Review Workflow

When a candidate is found:

1. Add it to `review-candidates.json`.
2. Human editor reviews it.
3. If approved, add a JSON rule.
4. Add the decision to this document if it establishes a reusable principle.
5. Re-run the normalizer.

This workflow makes linguistic decisions auditable and reusable across TBESH,
TBESG, TFLSJ, and future lexicons.
