import os
import re
import sys
from pathlib import Path

def run_consumer_lint(target_dir):
    """
    Sweeps a consumer frontend directory to ensure compliance with the 
    Sutram IoC Micro-Kernel and yenVUI presentation standards.
    """
    print(f"🔍 Sweeping Consumer JavaScript (UDF & Sutram Compliance) in {target_dir}...")
    violations_found = 0

    # Core Architectural Anti-Patterns
    dom_read_pattern = re.compile(r'document\.(?:getElementById|querySelector)\([^\)]+\)(?:\.(value|checked|classList)|\[[\'"](value|checked|classList)[\'"]\]|\.getAttribute\([\'"](value|checked|class)[\'"]\))')
    interval_pattern = re.compile(r'\bsetInterval\s*\(')
    hex_color_pattern = re.compile(r'#[0-9a-fA-F]{3,6}\b')
    clear_timeout_pattern = re.compile(r'\bclearTimeout\s*\(')
    dom_annihilation_pattern = re.compile(r'(?:\.innerHTML|\[[\'"]innerHTML[\'"]\])\s*=\s*([\'"`][\'"`])')
    raw_fetch_pattern = re.compile(r'\bfetch\s*\(')
    
    # LitElement Specific Anti-Patterns
    imperative_dom_create_pattern = re.compile(r'document\.createElement\(')
    global_listener_pattern = re.compile(r'window\.addEventListener\s*\(')
    global_dispatch_pattern = re.compile(r'window\.dispatchEvent\s*\(\s*new\s+CustomEvent')
    
    # Layout and Environmental Constraints
    media_layout_pattern = re.compile(r'@media\s*\([^)]*(?:width|height)[^)]*\)')
    banned_cdn_import_pattern = re.compile(r'from\s+[\'"]https?://(esm\.sh|cdn\.jsdelivr\.net|unpkg\.com)')
    banned_yenvui_tag_pattern = re.compile(r'\byenvui-')

    for root, _, files in os.walk(target_dir):
        for file in files:
            if not file.endswith(".js"): 
                continue
            
            filepath = Path(root) / file
            
            with open(filepath, "r", encoding="utf-8") as f:
                lines = f.readlines()
                
            is_lit_component = any(re.search(r'from\s+[\'"]lit[\'"]', l) for l in lines)
            
            for i, line in enumerate(lines):
                line_num = i + 1
                if line.strip().startswith("//"): 
                    continue
                
                def report(rule, msg):
                    nonlocal violations_found
                    violations_found += 1
                    print(f"❌ [VIOLATION: {rule}] {filepath.as_posix()}:{line_num}\n   ↳ {msg}\n")

                # State Management & UDF
                if dom_read_pattern.search(line):
                    report("DOM_READ_BAN", "Direct DOM reading detected. Read from the centralized Zustand Store instead.")
                
                if interval_pattern.search(line):
                    report("METRONOME_MANDATE", "Raw setInterval detected. Use ExtensionRegistry.registerTick() or the central Poller to prevent ghost memory leaks.")
                    
                if clear_timeout_pattern.search(line) and "utils.debounce" not in line:
                    report("DEBOUNCE_MANDATE", "Raw clearTimeout detected. Use window.ExtensionRegistry.utils.debounce() for safe input throttling.")

                if raw_fetch_pattern.search(line):
                    report("EXPLICIT_API_MANDATE", "Raw fetch() detected. Route network requests strictly through the explicit API SDK wrapper.")

                # DOM Mutability
                if dom_annihilation_pattern.search(line):
                    report("SURGICAL_DOM_MANDATE", "DOM annihilation detected. Use surgical layout reconciliation instead of clearing .innerHTML directly.")

                if is_lit_component and imperative_dom_create_pattern.search(line):
                    report("IMPERATIVE_DOM_CREATION", "document.createElement detected in a LitElement. Construct templates declaratively using lit-html.")

                if is_lit_component and global_listener_pattern.search(line):
                    report("GLOBAL_LISTENER_MANDATE", "Raw window.addEventListener detected. Use this.registerGlobalListener() to guarantee teardown on unmount.")

                if is_lit_component and global_dispatch_pattern.search(line):
                    report("CUSTOM_EVENT_DISPATCH_MANDATE", "Raw window.dispatchEvent detected. Route through this.dispatch(eventName, detail) for streamlined telemetry.")

                # Layout Physics & Theme Safety
                if hex_color_pattern.search(line) and ("style=" in line or "cssText" in line):
                    report("THEME_TOKENS", "Hardcoded HEX color found. Use semantic CSS intent variables (e.g., var(--intent-primary)).")

                if media_layout_pattern.search(line):
                    report("CONTAINER_QUERY_MANDATE", "Responsive layout via @media viewport boundaries detected. Utilize @container queries for component-level elasticity.")

                if banned_cdn_import_pattern.search(line):
                    report("BANNED_CDN_IMPORT", "Hardcoded external CDN import detected. All packages must be mapped through local vendor topologies.")

    return violations_found

if __name__ == "__main__":
    target = sys.argv[1] if len(sys.argv) > 1 else "."
    violations = run_consumer_lint(target)
    if violations == 0:
        print("✅ SUCCESS: Consumer codebase complies with Sutram UI/UDF standards.")
        sys.exit(0)
    else:
        print(f"❌ FAILED: Found {violations} architectural violations.")
        sys.exit(1)