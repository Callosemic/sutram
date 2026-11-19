import ast
import re
from pathlib import Path
from .core import PROJECT_ROOT, SUTRAM_DIR, YENVUI_DIR, report_violation, collect_unique_files
from ..sutram_consumer_linter import iter_sutram_tags, load_declared_properties, undeclared_bindings
def check_sutram_rules():
    print("🔍 Sweeping Sutram Micro-Kernel & Domain Decoupling...")
    domain_leak_pattern = re.compile(
        r'\b(?:inSetu|insetu|Quickpack|cleanCodeArtifacts|cite_start|include_prompt|plan_uri|freshdesk_ticket)\b'
        r'|[\'"](?:insetu-[a-z0-9-]+|file:(?:prompt|note|task|context|diff)|config-repo|yomama-turn)[\'"]'
        r'|yomama://|vfs:(?:diff|pairdiff):|/fs/save\b'
    )
    relative_yenvui_import_pattern = re.compile(r'(?:from|import)\s+[\'"][^\'"]*yenvui/[^\'"]*[\'"]')
    interval_pattern = re.compile(r'\bsetInterval\s*\(')
    legacy_store_pattern = re.compile(r"create(?:Extension|Sutram)Store\s*\([\s\S]*?,\s*\[\s*['\"]")
    impure_render_pattern = re.compile(r"render\s*\(\s*\)\s*[{]\s*this\._rebuildMenu\s*\(")
    sutram_inline_style_pattern = re.compile(r"<sutram-[a-z0-9-]+\b[^>]*\bstyle\s*=")
    declared_properties = load_declared_properties(PROJECT_ROOT)

    for filepath in collect_unique_files([SUTRAM_DIR / "js", YENVUI_DIR / "js"], [".js"]):
        with open(filepath, "r", encoding="utf-8") as f:
            lines = f.readlines()
        content = "".join(lines)

        if "sutram" in filepath.parts:
            for tag, tag_line, attrs, names in iter_sutram_tags(content):
                tag_text = f"<{tag} {attrs}>"
                if sutram_inline_style_pattern.search(tag_text):
                    report_violation(
                        "SUTRAM_INLINE_STYLE_BAN",
                        filepath,
                        tag_line,
                        f"Inline style='...' attribute detected on <{tag}>. Use semantic properties or class rules instead."
                    )
                for binding in undeclared_bindings(tag, names, declared_properties):
                    report_violation(
                        "SUTRAM_UNDECLARED_PROPERTY",
                        filepath,
                        tag_line,
                        f"<{tag}> has no declared property for '{binding}'."
                    )

        if legacy_store_pattern.search(content):
            report_violation(
                "STORE_PERSISTENCE_SCHEMA_COMPLIANCE",
                filepath,
                1,
                "Legacy array persistKeys detected in store instantiation. Migrate to persistenceSchema object ({ localSync, sessionSync })."
            )

        if impure_render_pattern.search(content):
            report_violation(
                "LIT_RENDER_PURITY_COMPLIANCE",
                filepath,
                1,
                "Impure this._rebuildMenu() call detected synchronously inside render(). Move state mutations to willUpdate() or store subscriptions."
            )

        for idx, line in enumerate(lines, start=1):
            if line.strip().startswith("//"):
                continue
            if domain_leak_pattern.search(line):
                report_violation(
                    "HOST_DOMAIN_ISOLATION",
                    filepath,
                    idx,
                    "Host domain reference ('window.inSetu', 'insetu-*', 'yomama://') detected. Sutram must remain purely host-agnostic."
                )
            if "sutram" in filepath.parts and relative_yenvui_import_pattern.search(line):
                report_violation(
                    "SUTRAM_CHASSIS_IMPORT_ISOLATION",
                    filepath,
                    idx,
                    "Hardcoded relative 'yenvui/' import detected in Sutram kernel. Import the active chassis strictly via 'sutram-chassis'."
                )
            if interval_pattern.search(line) and not (filepath.name == "sutram_sdk.js" and "setInterval(callback, delayMs)" in line):
                report_violation(
                    "METRONOME_MANDATE",
                    filepath,
                    idx,
                    "Raw setInterval detected. Use registerTick() or registerInterval() for coordinated visibility backoff."
                )
    primitives_path = SUTRAM_DIR / "js" / "primitives.js"
    if primitives_path.exists():
        prim_src = primitives_path.read_text(encoding="utf-8")
        if ".keyFunction=${this.keyFunction}" not in prim_src or "--card-content-visibility: visible" not in prim_src:
            report_violation(
                "VIRTUAL_LIST_KEY_FUNCTION_MANDATE",
                primitives_path,
                1,
                "SutramVirtualList must bind .keyFunction on <lit-virtualizer> and set '--card-content-visibility: visible' to prevent iOS WebKit DOM recycling and paint bugs."
            )
    code_index_path = PROJECT_ROOT / "CODE_INDEX.md"
    if code_index_path.exists():
        stale_count = 0
        with open(code_index_path, "r", encoding="utf-8") as f:
            for idx, line in enumerate(f, start=1):
                if "# [stale?]" in line:
                    stale_count += 1
                    print(f"  ⚠️ [WARN] CODE_INDEX_STALE_SYMBOL ({code_index_path.name}:{idx}): {line.strip()}")
                elif "# [comment required]" in line:
                    tree_entry = line.split("#", 1)[0].lstrip(" │├└─\t").strip()
                    if tree_entry.startswith(("def ", "async def ", "class ", "function ")):
                        continue
                    report_violation("CODE_INDEX_PLACEHOLDER_BAN", code_index_path, idx, f"Unresolved comment placeholder: {line.strip()}")
        if stale_count:
            print(f"  ℹ️ {stale_count} [stale?] symbol description(s) in CODE_INDEX.md (non-blocking).")

    detached_window_mock_re = re.compile(r'globalThis\.window\s*=\s*\{')
    for test_fp in collect_unique_files([PROJECT_ROOT / "tests"], [".py", ".mjs", ".js"]):
        if test_fp.name == "rules_sutram.py":
            continue
        try:
            test_text = test_fp.read_text(encoding="utf-8")
        except OSError:
            continue
        for m in detached_window_mock_re.finditer(test_text):
            line_no = test_text[:m.start()].count("\n") + 1
            report_violation(
                "DETACHED_WINDOW_MOCK_BAN",
                test_fp,
                line_no,
                "Assigning a detached object literal to 'globalThis.window = {...}' splits window.<api> from globalThis.<api>. Use js_loader.mjs or 'Object.assign(globalThis, {...}); globalThis.window = globalThis;'."
            )

    for py_path in collect_unique_files([PROJECT_ROOT / "tests"], [".py"]):
        try:
            with open(py_path, "r", encoding="utf-8") as f:
                tree = ast.parse(f.read(), filename=py_path.as_posix())
        except Exception:
            continue
        for node in ast.walk(tree):
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                for child in ast.walk(node):
                    if isinstance(child, (ast.Import, ast.ImportFrom)):
                        for alias in child.names:
                            effective_name = alias.asname or alias.name
                            if not effective_name.startswith("_"):
                                report_violation(
                                    "PYTHON_INLINE_IMPORT_SAFETY",
                                    py_path,
                                    child.lineno,
                                    f"Inline import '{alias.name}' inside '{node.name}()' must be aliased with a leading underscore (e.g. as _{alias.name.split('.')[-1]})."
                                )