# bg-lexicon-normalizer

Offline TypeScript tool for normalizing already translated Bulgarian biblical
lexicon and dictionary text. It does not translate and does not call OpenAI,
AI APIs, or any external service.

Version `0.1.0` supports deterministic verb normalization in DOCX files using
local JSON rules.

## Install

```bash
npm install
npm run build
```

## Normalize a DOCX

```bash
npm run normalize -- input.docx
```

The command writes:

```text
output/
├── input.normalized.docx
├── changes.json
├── review-candidates.json
└── report.md
```

Use a custom output directory:

```bash
npm run normalize -- input.docx --out-dir normalized-output
```

Choose a source profile explicitly:

```bash
npm run normalize -- input.docx --profile auto
npm run normalize -- input.docx --profile step-minimal
npm run normalize -- input.docx --profile leh-inline
```

If `--profile` is omitted, v0.1 uses `auto`: it defaults to `step-minimal` when
`@@...:G@@` or `@@...:D@@` markers are present and auto-detects `leh-inline` for
Greek lemma lines that contain ` – `.

## What v0.1 Does

- Reads `word/document.xml` from a DOCX file.
- Preserves marker paragraphs such as `@@000001:G@@` and `@@000001:D@@`.
- Preserves paragraph order and empty paragraphs.
- Applies verb rules from:
  - `data/verbs.json`
  - `data/passive-verbs.json`
  - `data/reflexive-verbs.json`
- Writes a normalized DOCX.
- Writes `changes.json`.
- Writes `review-candidates.json` for remaining Bulgarian `да ...` verb-like phrases.
- Writes `report.md`.

DOCX preservation note: v0.1 normalizes at paragraph level. If Word has split a
changed phrase across multiple `w:t` text runs, the normalized paragraph text may
be written into the first `w:t` node while the remaining text nodes are cleared.
This keeps paragraph order and markers stable, but does not guarantee run-level
formatting preservation for changed paragraphs.

## What v0.1 Does Not Do

- No AI, no OpenAI API, no external inference service.
- No translation.
- No aggressive terminology editing.
- No entry deletion or reordering.
- No changes to marker tokens like `@@000006:D@@`.
- No intentional changes to Greek, Hebrew, or Strong's markers.

## Rule Example

```json
[
  {
    "canonical": "загивам",
    "patterns": ["да загине", "да погине", "да бъде изгубен"],
    "category": "verb",
    "type": "active",
    "confidence": 1
  }
]
```

Input:

```text
@@000006:G@@
загивам
@@000006:D@@
1) да загине, да изчезне, да се отклони от пътя, да бъде унищожен
```

Output:

```text
@@000006:G@@
загивам
@@000006:D@@
1) загивам, изчезвам, отклонявам се от пътя, унищожен съм
```


## Documentation

The README is intentionally short. The full project specification lives in
`docs/`:

- `docs/PROJECT.md` — goals, scope, non-goals, offline philosophy;
- `docs/ARCHITECTURE.md` — modules, data flow, pipeline;
- `docs/CANONICAL_BULGARIAN.md` — canonical Bulgarian editorial rules;
- `docs/RULE_ENGINE.md` — rule loading, priority, conflicts, reporting;
- `docs/NORMALIZATION_RULES.md` — human-readable normalization decisions;
- `docs/ROADMAP.md` — planned versions and future work.

## Tests

```bash
npm test
```

The tests cover the initial sample verb rules and marker preservation.
