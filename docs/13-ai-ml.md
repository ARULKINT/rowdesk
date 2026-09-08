# 13 — AI / ML Documentation

## Status: Not Implemented

Rowdesk contains **no artificial intelligence or machine learning functionality of any kind**. This was confirmed by inspecting every dependency in `package.json` and every module in `src/lib` and `src/app` — there is:

- No LLM API integration (no OpenAI, Anthropic, or similar SDK).
- No embeddings, vector database, or RAG pipeline.
- No trained or pretrained model of any kind, and no inference code.
- No prompt templates in the AI sense — the "templates" elsewhere in this documentation ([11-business-logic.md](11-business-logic.md)) are plain outreach-message strings with simple `{name}`/`{domain}` token substitution, not LLM prompts.
- No automated data classification beyond deterministic rule-based logic (e.g. `classifyDriveFile()`'s new/updated/unchanged comparison is a timestamp comparison, not a model).

## Why This Section Exists

This documentation package's template explicitly calls for an AI/ML section when applicable, and instructs that it be **omitted** when not applicable. It is included here in "not implemented" form rather than omitted outright so that a reader scanning the full 27-document set has an explicit, unambiguous confirmation — rather than silence that could be mistaken for an oversight — that no AI/ML capability exists in this codebase as of this writing.

If AI/ML functionality is added in the future (e.g. AI-assisted outreach-message drafting, lead-quality scoring), this document should be rewritten to cover models, providers, prompts, evaluation, cost, and failure modes per the standard structure used elsewhere in this package.
