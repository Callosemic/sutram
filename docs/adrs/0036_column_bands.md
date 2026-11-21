# ADR-0036: Column Bands as the Only Responsive Widths

* **Status:** Accepted
* **Date:** 2026-11-20
* **Scope:** `yenvui/js/physics.js`, `yenvui/js/card.js`, `yenvui/js/diff-viewer.js`, `yenvui/js/window.js`, the yenvui and sutram components that had container or media queries, `sutram/js/app_shell.js`, `sutram/js/sutram_sdk.js`, `sutram/js/primitives.js`, `sutram/js/inputs.js`, `tests/fitness/rules_sutram.py`
* **Model:** `docs/models/column_bands.md` in insetu (the owner's dictation).

## Context

Components kept private guesses at "narrow": 480 px in seven container queries, 520 px for the chip menus' icon rail, the diff viewer's labels and a window-width media query, 700 and 1100 px in the board, 768 px for the diff viewer's side-by-side and the pop-out check, 45rem in the layout sidebar. Cards measured their own box against `WIDE_CARD_MIN_PX` (720), so a card in a 720 px column, about 675 px inside its padding, never showed its actions inline. The column count was `floor(width / 360)`, written out three times.

## Decision

1. **One table in `yenvui/js/physics.js`.** `COLUMN_UNIT_PX` (360) sets the bands: narrow below 720, medium 720 to 1080, wide from 1080, each including its minimum. `COMPACT_MAX_PX` (384) marks a narrow column below it as compact. `WIDE_CARD_MIN_PX` and `SUTRAM_WIDE_CARD_MIN_PX` are removed.
2. **A band belongs to the container, not the element.** Columns, window bodies and the shell are named `yv-band` containers and carry the spatial-boundary marker, so CSS (`@container ${BAND_QUERY.narrow}`) and JavaScript (`findColumnContainer`, `observeColumnBand`) read the same box. A pane that divides a column (`<yenvui-layout>`'s sidebar) is a band container too (`data-band-container`), so the cards it holds follow its width, not the column's; popovers still clamp to the spatial boundary. The column divider is a 1 px `::after` line instead of a border, so a column's width is exactly its share (two columns of a 1440 px window are 720, medium).
3. **What each band may change.** Layout steps go by band: cards show actions inline from medium, the card's detail line hides in narrow, the diff viewer goes side by side in Auto only in wide (amended 2026-11-20, see below), the board has one, two or three grid columns, the layout sidebar becomes a rail in narrow, the settings binding grid stacks in narrow. Compact only saves horizontal room: edge-to-edge cards, groups, collapsibles, lists and views, the tray chip's icon and count, the chip menus' icon rail, the diff viewer's icon-only mode buttons.
4. **The column count.** `columnCountFor(width)` switches halfway between capabilities (540 and 900) and depends only on the width, so it can only move in the direction of a resize. The shell, `setUserCapacity` and the URL parser all call it.
5. **The pop-out check** asks for a touch pointer and capability 1 instead of a 768 px window.
6. **Diff wrap and remembered mode.** `<yenvui-diff-viewer>` gains `.wrap` (`auto` wraps in a narrow column; side by side never wraps, since its panes scroll in step) and a Wrap toggle, and Unified opens on its first change. `<sutram-diff-viewer>` keeps mode and wrap in `DiffViewStore` (device-local), so every diff opens the way the last one was left.
7. **Enforcement.** `RAW_BAND_WIDTH_BAN` (`tests/fitness/rules_sutram.py`) bans raw widths in container and media queries, `matchMedia` width tests, width comparisons and unit arithmetic everywhere except `physics.js`.

## Consequences

- Narrow columns between 480 and 720 px now hide the card detail line; compact spacing applies below 384 instead of 480, so 384 to 480 px columns keep their side borders.
- The chip menus' icon rail and the diff viewer's icon-only buttons appear only in compact columns, not below 520.
- Removing `WIDE_CARD_MIN_PX` changes the public exports; no consumer used it.

## Amendment (2026-11-20)

The diff viewer's Auto shows Unified, wrapped, below a wide column and side by side only in a wide one. At 720 to 768 px side by side cut both lines short, and Unified with the changed span highlighted proved the more useful view in most cases. Stacked stays available as an explicit choice; Auto never picks it.
