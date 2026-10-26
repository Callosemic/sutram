import os
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
SUTRAM_DIR = PROJECT_ROOT / "sutram"
YENVUI_DIR = PROJECT_ROOT / "yenvui"

class FitnessState:
    violations_found = 0

def report_violation(rule_name, filepath, line_num, message):
    FitnessState.violations_found += 1
    try:
        rel_path = Path(filepath).resolve().relative_to(PROJECT_ROOT.resolve())
        display_path = f"[sutram]/{rel_path.as_posix()}"
    except ValueError:
        display_path = Path(filepath).as_posix()

    print(f"❌ [VIOLATION: {rule_name}] {display_path}:{line_num}")
    print(f"   ↳ {message}\n")

def collect_unique_files(directories, extensions):
    seen = set()
    for directory in directories:
        d_path = Path(directory)
        if not d_path.exists():
            continue
        for root, dirs, files in os.walk(d_path):
            for skip_dir in ("node_modules", "vendor", ".git", ".venv", "venv", "env", "__pycache__", "build", "dist", ".pytest_cache"):
                if skip_dir in dirs:
                    dirs.remove(skip_dir)
            for file in files:
                if any(file.endswith(ext) for ext in extensions):
                    fp = (Path(root) / file).resolve()
                    if fp not in seen:
                        seen.add(fp)
                        yield fp