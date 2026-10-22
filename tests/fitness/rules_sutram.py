import ast
import re
from pathlib import Path
from .core import PROJECT_ROOT, SUTRAM_DIR, YENVUI_DIR, report_violation, collect_unique_files
def check_sutram_rules():
    print("🔍 Sweeping Sutram Micro-Kernel & Domain Decoupling...")
    domain_leak_pattern = re.compile(r'\bwindow\.inSetu\b|[\'"]insetu-[a-z0-9-]+[\'"]|yomama://|vfs:(?:diff|pairdiff):|/fs/save\b')
    interval_pattern = re.compile(r'\bsetInterval\s*\(')
    legacy_store_pattern = re.compile(r"create(?:Extension|Sutram)Store\s*\([\s\S]*?,\s*\[\s*['\"]")
    impure_render_pattern = re.compile(r"render\s*\(\s*\)\s*[{]\s*this\._rebuildMenu\s*\(")

    for filepath in collect_unique_files([SUTRAM_DIR / "js", YENVUI_DIR / "js"], [".js"]):
        with open(filepath, "r", encoding="utf-8") as f:
            lines = f.readlines()
        content = "".join(lines)

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
            if interval_pattern.search(line) and filepath.name != "sutram_sdk.js":
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
        with open(code_index_path, "r", encoding="utf-8") as f:
            for idx, line in enumerate(f, start=1):
                if "# [comment required]" in line:
                    report_violation("CODE_INDEX_PLACEHOLDER_BAN", code_index_path, idx, f"Unresolved comment placeholder: {line.strip()}")

    insetu_dir = PROJECT_ROOT.parent / "insetu"
    py_scan_dirs = [PROJECT_ROOT / "tests"] + ([insetu_dir] if insetu_dir.exists() else [])
    for py_path in collect_unique_files(py_scan_dirs, [".py"]):
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
                            if not alias.asname or not alias.asname.startswith("_"):
                                report_violation(
                                    "PYTHON_INLINE_IMPORT_SAFETY",
                                    py_path,
                                    child.lineno,
                                    f"Inline import '{alias.name}' inside '{node.name}()' must be aliased with a leading underscore (e.g. as _{alias.name.split('.')[-1]})."
                                )