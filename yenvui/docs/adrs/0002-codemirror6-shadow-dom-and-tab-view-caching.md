# ADR-0002: Encapsulated CodeMirror 6 Integration via Dynamic ESM Compartments and Tab View Caching Architecture

## Context
As yenVUI expanded to support rich code and configuration editing across client applications, two core presentation requirements emerged:
1. Providing a lightweight, bundleless code editing experience without bundling heavy language parsers upfront.
2. Preventing component re-initialization and DOM reflow thrashing when switching back and forth between active tabs in `<yenvui-tabs>`.

## Decision
1. **Dynamic Language Extension Compartments**: `<yenvui-editor>` dynamically imports CodeMirror 6 language modules on-demand from trusted ESM CDNs (`https://esm.sh`). Reconfiguration of read-only states, language extensions, and custom extensions is isolated using CodeMirror `Compartment` instances dispatched directly into the `EditorView`.
2. **Tab View Caching Pattern**: `<yenvui-tabs>` defaults `cacheViews` to `true`. Slotted views are projected into `.yenvui-tab-view` wrappers and toggled declaratively using `display: flex | none` matching `activeTab === tab.id`. This retains active state, scroll position, and DOM focus natively without requiring imperative `Map` tracking or `document.createElement` element generation.

## Consequences
* Eliminates heavy initial JavaScript bundle costs for syntax highlighting by lazily fetching language definitions on demand.
* Keeps complex views (such as active code editors or log streams) alive across tab navigation cycles.