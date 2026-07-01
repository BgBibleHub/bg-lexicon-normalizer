# Canonical Bulgarian

Canonical Bulgarian is the project's editorial target vocabulary. A canonical
form is not a new translation and not a machine-inferred lemma. It is a human
approved Bulgarian form that the normalizer may apply only when an explicit JSON
rule says so.

## General Principle

Every automatic normalization must be rule-backed:

```json
{
  "canonical": "загивам",
  "patterns": ["да загине", "да погине"],
  "category": "verb",
  "type": "active",
  "confidence": 1
}
```

This means:

```text
да загине -> загивам
да погине -> загивам
```

If a phrase is not present in `patterns`, v0.1 does not guess a canonical form.

## Canonical Verb Forms

For active verbs, the canonical form is normally the Bulgarian dictionary-style
imperfective first-person singular form where that is the approved editorial
choice.

Examples:

```text
да загине -> загивам
да изчезне -> изчезвам
да обичаш -> обичам
да купя -> купувам
да умра -> умирам
да видя -> виждам
да кажа -> казвам
да взема -> вземам
да дам -> давам
```

Some canonical forms may contain a direct object or fixed complement when the
lexicon gloss requires it:

```text
да правиш добро -> правя добро
```

The rule file must preserve that phrase intentionally. The engine should not
invent complements.

## Passive Verb Rules

Passive and adjectival predicate forms are normalized to the approved Bulgarian
predicate form. In v0.1 these rules live in `data/passive-verbs.json`.

Examples:

```text
да бъде унищожен -> унищожен съм
да бъда унищожен -> унищожен съм
да бъда невеж -> невеж съм
```

Passive rules should be explicit because Bulgarian passive and adjectival forms
can be context-sensitive. A rule should not rewrite every occurrence of an
adjective. It should rewrite only the listed source patterns.

Recommended passive rule shape:

```json
{
  "canonical": "унищожен съм",
  "patterns": ["да бъде унищожен", "да бъда унищожен"],
  "category": "verb",
  "type": "passive",
  "confidence": 1
}
```

## Reflexive Verb Rules

Reflexive verbs should preserve the reflexive particle in the canonical form,
usually after the verb.

Examples:

```text
да се отклони -> отклонявам се
да се отклоня -> отклонявам се
да се радвам -> радвам се
да се боря -> боря се
```

Recommended reflexive rule shape:

```json
{
  "canonical": "отклонявам се",
  "patterns": ["да се отклони", "да се отклоня"],
  "category": "verb",
  "type": "reflexive",
  "confidence": 1
}
```

Reflexive rules should not be derived automatically by moving `се`. The approved
canonical phrase must be written in the rule.

## Noun Rules

Noun normalization is planned beyond v0.1. A noun rule should map variant
Bulgarian renderings to a preferred lexicon term only when the semantic scope is
clear.

Possible examples:

```text
съюз -> завет
договор -> завет
споразумение -> завет
```

Noun rules should avoid broad replacements when a word has ordinary non-biblical
uses. For example, `съюз` should not always become `завет` outside a covenant
context unless a rule category or future context filter makes that safe.

Possible future rule shape:

```json
{
  "canonical": "завет",
  "patterns": ["договор", "съюз", "споразумение"],
  "category": "theological-term",
  "notes": "For biblical covenant contexts."
}
```

## Adjective Rules

Adjective normalization is also planned beyond v0.1. Adjective rules should be
even more conservative than verb rules because adjectives vary by gender,
number, definiteness, and syntactic role.

Possible examples:

```text
справедлив -> праведен
справедлива -> праведна
справедливо -> праведно
```

Adjective rules should usually include separate patterns for each approved form
instead of relying on automatic inflection.

## Examples

Sample input:

```text
@@000006:G@@
загивам
@@000006:D@@
1) да загине, да изчезне, да се отклони от пътя, да бъде унищожен
```

Sample normalized output:

```text
@@000006:G@@
загивам
@@000006:D@@
1) загивам, изчезвам, отклонявам се от пътя, унищожен съм
```

The markers remain unchanged. Only the Bulgarian phrases covered by rules are
normalized.

## Review Candidates

When v0.1 sees a remaining Bulgarian phrase that looks like `да ...`, it should
not guess. It should report the phrase in `review-candidates.json`.

Example candidate:

```text
да прославиш Бога
```

An editor can then decide whether to add a new rule, leave the phrase unchanged,
or handle it manually.

## Canonical Bulgarian Lexicon

The Canonical Bulgarian Lexicon (CBL) is the project's approved vocabulary layer.
It answers the question: "What Bulgarian form should this lexicon use here?"

CBL is not limited to verbs. It will eventually include:

- verbs: `загивам`, `умирам`, `виждам`;
- reflexive verbs: `отклонявам се`, `радвам се`;
- passive/adjectival verbal meanings: `унищожен съм`, `избран съм`;
- nouns: `завет`, `олтар`, `жертва`;
- adjectives: `праведен`, `свят`, `нечист`;
- names: `Авраам`, `Мойсей`, `Давид`;
- places: `Йерусалим`, `Галилея`, `Вавилон`;
- divine names and titles according to the chosen project standard.

A CBL entry is approved by humans. The normalizer only applies it when a rule
connects a source pattern to that canonical form.

## Editorial Confidence

`confidence` is an editorial value, not a model probability.

Recommended meaning:

```text
1.0  approved; safe for normal use
0.8  likely correct; useful but should be reviewed periodically
0.5  candidate; not enabled by default unless a workflow explicitly allows it
```

For production lexicon normalization, only approved rules should normally be
applied. Candidate forms should remain in review files until a human editor
accepts them.
