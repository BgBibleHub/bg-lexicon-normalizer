# Verb Normalization

Verb normalization maps Bulgarian infinitive-like glosses using `да ...`
phrases to dictionary-style canonical forms.

Examples:

```text
да загине -> загивам
да се отклони -> отклонявам се
да бъде унищожен -> унищожен съм
```

Rules are explicit. The normalizer does not infer new lemmas.

## Rule Files

- `data/verbs.json` for active forms.
- `data/reflexive-verbs.json` for reflexive forms.
- `data/passive-verbs.json` for passive or adjectival predicate forms.

Rules are applied longest pattern first to avoid shorter phrases shadowing
longer ones.

## Review Candidates

After normalization, remaining Bulgarian phrases beginning with `да` are
reported in `review-candidates.json`. They are not changed automatically.
