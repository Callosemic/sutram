# ADR-0029: Host-Agnostic Editor Language Descriptors, StreamLanguage Wrapping, Per-Language Caching, and Plain-Text Fallback

* **Status:** Accepted
* **Date:** 2026-10-31
* **Scope:** `yenvui/js/editor.js`, `docs/yenvui_contracts.md`, `docs/01_engineering_standards.md`

## Context

Previously, `loadLanguageExtension(lang)` in `yenvui/js/editor.js` mapped `.json` and `.ts` inaccurately, attempted an unmapped bare `import('@codemirror/lang-<mode>')` that always threw, accepted only URL strings from `YenvuiEditor.languageResolver`, lacked support for `@codemirror/legacy-modes` stream parsers, re-imported language packs on every editor mount, and fell back to `cm.markdown()` when a language pack was unavailable. Highlighting unknown or unbundled languages (such as Rust or TOML) as Markdown produced misleading syntax tokenization.

## Decision

1. **Corrected Core Built-ins**: Route `json` to `cm.json()`, `typescript`/`ts` to `cm.javascript({ typescript: true })`, `tsx` to `cm.javascript({ jsx: true, typescript: true })`, and `jsx` to `cm.javascript({ jsx: true })`.
2. **Host-Agnostic Descriptor Contract**: Expand `YenvuiEditor.languageResolver(languageId)` to accept either a legacy URL string or a descriptor object `{ url, kind: "lezer" | "stream" | "builtin", export, options? }`.
3. **StreamLanguage Wrapping**: When `kind === "stream"`, wrap the imported mode object via `cm.StreamLanguage.define(module[export])`.
4. **Module-Level Promise Cache**: Cache resolved language extension promises in a module-level `Map` (`_languageCache`) keyed by normalized language ID, ensuring multiple open editors for the same language import and initialize the pack once.
5. **Plain-Text Fallback & Dead Stage Removal**: Remove the dead bare `@codemirror/lang-*` import stage and fall back to plain text (`[]`) instead of Markdown when no language matches.

## Consequences

* **Positives:** Supports official Lezer packs and legacy stream modes through a single host-neutral contract; deduplicates dynamic imports across open buffers; eliminates misleading Markdown highlighting on non-Markdown files.
* **Trade-offs:** Hosts must return descriptors (or URLs) from `languageResolver`; unmapped extensions render as unhighlighted plain text.
