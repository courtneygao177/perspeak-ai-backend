---
name: Transcript merge dedup pitfall
description: When merging two lists of "answer" records from different sources, dedupe against the combined output list, not just the source you started from — otherwise entries silently double.
---

## The pattern that breaks

When combining data from two sources (e.g. frontend-captured history + server-side session
records) where one source is treated as "primary" and the other is merged in to "fill gaps":

```python
if condition:
    combined = list(source_a)
else:
    combined = list(source_b)

seen = {x.key for x in source_a}   # BUG: always checks against source_a only
for x in source_b:
    if x.key not in seen:
        combined.append(x)
        seen.add(x.key)
```

If `combined` was seeded from `source_b` (the `else` branch) and `source_a` is empty or smaller,
`seen` starts empty/small, so the merge loop thinks every `source_b` item is "not yet captured"
and re-appends items already in `combined` — silently doubling every record.

**Why:** the dedup set must reflect what's actually already in the output, not just one input branch.

**How to apply:** always build the "already seen" set from the list you are merging *into*
(`combined`), not from whichever source happened to seed it. This applies to any similar
two-source merge pattern (frontend + backend transcripts, cache + live data, etc.) — audit for it
whenever a merge step's dedup check references a variable name that isn't the accumulator itself.
