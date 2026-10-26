import re
from pathlib import Path
from .core import PROJECT_ROOT, YENVUI_DIR, SUTRAM_DIR, report_violation, collect_unique_files

def check_yenvui_rules():
    print("🔍 Sweeping yenVUI Presentation Chassis...")
    hex_color_pattern = re.compile(
        r'(?:color|background|border|fill|stroke)\s*:[^;]*?(#[0-9a-fA-F]{3,6}|\bwhite\b|\bblack\b)',
        re.IGNORECASE
    )
    event_pattern = re.compile(r"new\s+CustomEvent\(\s*['\"]([^'\"]+)['\"]")
    dialog_pattern = re.compile(r'<dialog\b|\bdialog\s*\{|::backdrop')
    host_none_pattern = re.compile(r':host[^{]*\{\s*display:\s*none')
    dialog_tag_pattern = re.compile(r'<dialog\b')
    teardown_pattern = re.compile(r'disconnectedCallback\s*\(\s*\)[\s\S]*?appendChild\([^)]*\)[\s\S]*?dialog\.close\(\)')
    container_media_pattern = re.compile(r'@media\s*\([^)]*max-width')
    touchmove_pattern = re.compile(r"addEventListener\(\s*['\"]touchmove['\"]")
    passive_false_pattern = re.compile(r"\{\s*passive\s*:\s*false\s*\}")
    flex_grid_pattern = re.compile(r'display:\s*(?:flex|grid)')
    min_width_pattern = re.compile(r'min-width:\s*0')
    observer_pattern = re.compile(r'new\s+ResizeObserver')
    disconnect_pattern = re.compile(r'disconnectedCallback\s*\(\s*\)[\s\S]*?\.disconnect\(\)')
    inner_html_pattern = re.compile(r'\.innerHTML\s*=')
    body_overflow_pattern = re.compile(r'document\.body\.style\.overflow\s*=')
    scan_dirs = [YENVUI_DIR / "js"]
    for filepath in collect_unique_files(scan_dirs, [".js"]):
        with open(filepath, "r", encoding="utf-8") as f:
            lines = f.readlines()
        content = "".join(lines)

        # 1. Structural multi-line scans
        if dialog_tag_pattern.search(content) and not teardown_pattern.search(content):
            report_violation(
                "DIALOG_TEARDOWN_COMPLIANCE",
                filepath,
                1,
                "Wraps native <dialog> but lacks disconnectedCallback unmount teardown with re-attachment."
            )

        if flex_grid_pattern.search(content) and ('class="body"' in content or 'class="card-body"' in content):
            if not min_width_pattern.search(content):
                report_violation(
                    "FLEX_GRID_MIN_WIDTH_MANDATE",
                    filepath,
                    1,
                    "Body flex/grid layout container lacks 'min-width: 0' blowout protection."
                )

        if observer_pattern.search(content) and not disconnect_pattern.search(content):
            report_violation(
                "RESIZE_OBSERVER_CLEANUP",
                filepath,
                1,
                "Instantiates ResizeObserver but lacks disconnect() in disconnectedCallback."
            )

        if "preventDefault()" in content and touchmove_pattern.search(content):
            if not re.search(r'passive\s*:\s*false', content):
                report_violation(
                    "TOUCHMOVE_PASSIVE_COMPLIANCE",
                    filepath,
                    1,
                    "Contains touchmove preventDefault() but lacks { passive: false } event listener options."
                )

        # 2. Line-by-line checks
        for idx, line in enumerate(lines, start=1):
            if line.strip().startswith("//") or line.strip().startswith("/*"):
                continue

            if hex_color_pattern.search(line) and 'var(' not in line and 'theme-tokens.css' not in filepath.name:
                lower = line.lower()
                # Whitelist standard monochrome tokens, CodeMirror internals, and e-ink brutalist accents
                if not any(t in lower for t in ('white', 'black', '#000', '#fff', '#ffffff', '#000000', 'codemirror', '#ec4899', '#8b5cf6', '#eab308', '#14b8a6', '#d946ef', '#f97316')):
                    report_violation("THEME_TOKEN_COMPLIANCE", filepath, idx, f"Hardcoded style color detected: {line.strip()}")

            evt_match = event_pattern.search(line)
            if evt_match:
                e_name = evt_match.group(1)
                if not (e_name.startswith('yenvui-') or e_name.startswith('yv-') or e_name.startswith('sutram-') or e_name.startswith('sutram:')):
                    report_violation("CUSTOM_EVENT_NAMESPACE", filepath, idx, f"CustomEvent '{e_name}' lacks namespace prefix ('yenvui-', 'yv-', or 'sutram-').")
            if container_media_pattern.search(line):
                report_violation("CONTAINER_QUERY_MANDATE", filepath, idx, "Viewport @media max-width detected. Use CSS @container queries instead.")
            if inner_html_pattern.search(line):
                report_violation("NO_INNER_HTML_MANDATE", filepath, idx, "Banned .innerHTML assignment detected. Render declaratively with Lit.")
            if body_overflow_pattern.search(line) and filepath.name != "physics.js":
                report_violation(
                    "BODY_OVERFLOW_DIRECT_WRITE_BAN",
                    filepath,
                    idx,
                    "Direct 'document.body.style.overflow' assignment detected. Use acquireBodyScrollLock() and releaseBodyScrollLock() for reentrant lock safety."
                )

    theme_tokens_path = YENVUI_DIR / "css" / "theme-tokens.css"
    if theme_tokens_path.exists():
        theme_css = theme_tokens_path.read_text(encoding="utf-8")
        if "-webkit-text-size-adjust: 100%" not in theme_css:
            report_violation(
                "WEBKIT_TEXT_SIZE_ADJUST_MANDATE",
                theme_tokens_path,
                1,
                "theme-tokens.css must enforce '-webkit-text-size-adjust: 100%' to prevent iOS WebKit font-size inflation across virtualized and container-queried blocks."
            )

    card_js_path = YENVUI_DIR / "js" / "card.js"
    if card_js_path.exists():
        card_src = card_js_path.read_text(encoding="utf-8")
        if "--card-content-visibility" not in card_src or "--card-contain-intrinsic-size" not in card_src:
            report_violation(
                "VIRTUALIZER_CONTENT_VISIBILITY_GUARD",
                card_js_path,
                1,
                "YenvuiCard must parameterize content-visibility and contain-intrinsic-size via CSS custom properties so virtualized lists can disable double-virtualization on iOS WebKit."
            )