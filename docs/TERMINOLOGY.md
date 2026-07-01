# Terminology

Terminology normalization is planned, but v0.1 intentionally does not apply
aggressive terminology edits.

The file `data/terminology.json` documents the intended rule shape for future
versions:

```json
{
  "canonical": "завет",
  "patterns": ["договор", "съюз", "споразумение"],
  "category": "theological-term",
  "notes": "For biblical covenant contexts."
}
```

Future terminology normalization should remain rule-based, local, and
auditable.
