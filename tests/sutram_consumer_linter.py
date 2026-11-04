import os
import re
import sys
from pathlib import Path
def strip_lit_expressions(line):
    """
    Replaces every Lit ${...} expression on a line with an empty '${}' (brace-balanced, so arrow
    functions and object literals inside bindings are removed whole). Tag-content regexes can then
    reason about markup without '=>' or '>' inside bindings ending a tag early. An expression left
    open at the end of the line is stripped to the end of the line.
    """
    out = []
    i = 0
    n = len(line)
    while i < n:
        if line.startswith("${", i):
            depth = 1
            j = i + 2
            while j < n and depth:
                if line[j] == "{":
                    depth += 1
                elif line[j] == "}":
                    depth -= 1
                j += 1
            out.append("${}")
            i = j
        else:
            out.append(line[i])
            i += 1
    return "".join(out)


SUTRAM_ROOT = Path(__file__).resolve().parent.parent
# Attributes any element may carry; they are not component properties.
GLOBAL_ATTRIBUTES = frozenset({
    "slot", "id", "class", "part", "title", "role", "tabindex", "hidden", "style", "key", "name", "draggable", "lang", "dir",
})


def iter_sutram_tags(text):
    """
    Yields (tag_name, line_number, attribute_text, names_text) for every <sutram-*> opening tag in a file. Tags may
    span lines; Lit ${...} bindings are skipped brace-balanced, so '>' inside them never ends a tag. attribute_text
    keeps quoted values (for value rules such as size="sm"); names_text also blanks them, for reading binding names.
    """
    for match in re.finditer(r"<(sutram-[a-z0-9-]+)", text):
        i = match.end()
        n = len(text)
        while i < n and text[i] != ">":
            if text.startswith("${", i):
                depth = 1
                i += 2
                while i < n and depth:
                    if text[i] == "{":
                        depth += 1
                    elif text[i] == "}":
                        depth -= 1
                    i += 1
                continue
            if text[i] in "\"'":
                quote = text[i]
                i += 1
                while i < n and text[i] != quote:
                    i += 1
            i += 1
        attrs = " ".join(strip_lit_expressions(text[match.end():i]).split())
        names = re.sub(r'"[^"]*"|\'[^\']*\'', '""', attrs)
        yield match.group(1), text.count("\n", 0, match.start()) + 1, attrs, names


def load_declared_properties(sutram_root=SUTRAM_ROOT):
    """
    Maps every sutram-* tag to {property name: attribute name}, following class inheritance and mixins
    (class X extends Mixin(Base)) and including observedAttributes of plain HTMLElement classes.
    """
    classes, tag_to_class, aliases, passthrough_tags = {}, {}, {}, {}
    sources = list((sutram_root / "sutram" / "js").glob("*.js")) + list((sutram_root / "yenvui" / "js").glob("*.js"))
    for source in sources:
        text = source.read_text(encoding="utf-8")
        for m in re.finditer(r"class (\w+) extends ([\w(), ]+?)\s*\{", text):
            body_start = m.end()
            nxt = re.search(r"\n(?:export )?class \w+ extends", text[body_start:])
            body = text[body_start: body_start + (nxt.start() if nxt else len(text))]
            props = {}
            pm = re.search(r"static (?:get )?properties\s*(?:=|\(\)\s*\{\s*return)\s*(\{.*?\n\s*\})", body, re.S)
            spreads = []
            if pm:
                for prop in re.finditer(r"^\s*(\w+)\s*:\s*\{([^}]*)\}", pm.group(1), re.M):
                    attr = re.search(r"attribute\s*:\s*(?:'([^']*)'|(false))", prop.group(2))
                    if attr and attr.group(2):
                        props[prop.group(1)] = None
                    else:
                        props[prop.group(1)] = attr.group(1) if attr else prop.group(1).lower()
                spreads = re.findall(r"\.\.\.(\w+)\.properties", pm.group(1))
            observed = re.search(r"observedAttributes\(\)\s*\{\s*return\s*\[([^\]]*)\]", body)
            if observed:
                for attr in re.findall(r"'([^']+)'", observed.group(1)):
                    props[attr] = attr
            inner = re.findall(r"\((\w+)\)", m.group(2))
            base = inner[-1] if inner else m.group(2).split("(")[0].strip()
            classes[m.group(1)] = {"bases": [base] + spreads, "props": props}
        for m in re.finditer(r"(?:customElements\.define|_safeDefine)\(\s*'(sutram-[a-z0-9-]+)'\s*,\s*(?:class extends\s+)?(\w+)", text):
            tag_to_class[m.group(1)] = m.group(2)
        # Chassis exports are re-named (YenvuiInput as Input, Icon: YenvuiIcon); passthrough tags map to export names.
        for m in re.finditer(r"\b(Yenvui\w+)\s+as\s+(\w+)|\b(\w+)\s*:\s*(Yenvui\w+)\b", text):
            if m.group(1):
                aliases[m.group(2)] = m.group(1)
            else:
                aliases[m.group(3)] = m.group(4)
        passthrough = re.search(r"PASSTHROUGH_MAP\s*=\s*Object\.freeze\(\{(.*?)\}\)", text, re.S)
        if passthrough:
            for tag, export_key in re.findall(r"'(sutram-[a-z0-9-]+)'\s*:\s*'(\w+)'", passthrough.group(1)):
                passthrough_tags[tag] = export_key

    for tag, export_key in passthrough_tags.items():
        tag_to_class.setdefault(tag, export_key)

    def resolve(cls, seen):
        cls = aliases.get(cls, cls)
        if cls in seen or cls not in classes:
            return {}
        seen.add(cls)
        merged = {}
        for base in classes[cls]["bases"]:
            merged.update(resolve(base, seen))
        merged.update(classes[cls]["props"])
        return merged

    return {tag: resolve(cls, set()) for tag, cls in tag_to_class.items()}


def undeclared_bindings(tag, attrs, declared):
    """Names bound on a sutram tag that the component does not declare (so the binding silently does nothing)."""
    props = declared.get(tag)
    if props is None:
        return []
    attr_names = {a for a in props.values() if a}
    problems = []
    for m in re.finditer(r"(?:^|\s)([.?@]?)([A-Za-z_][\w:-]*)(?=\s*=|\s|$)", attrs):
        kind, name = m.groups()
        if kind == "@" or name in GLOBAL_ATTRIBUTES or name.startswith(("aria-", "data-")):
            continue
        if kind == ".":
            if name not in props:
                problems.append(f".{name}")
        elif name.lower() not in attr_names:
            problems.append(f"{kind}{name}" + (f" (the property's attribute is '{props[name]}')" if name in props and props[name] else ""))
    return problems


def run_consumer_lint(target_dir, allow_host_globals=False):
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
    # LitElement Specific Anti-Patterns & Substrate Guardrails
    imperative_dom_create_pattern = re.compile(r'document\.createElement\(')
    global_listener_pattern = re.compile(r'window\.addEventListener\s*\(')
    global_dispatch_pattern = re.compile(r'window\.dispatchEvent\s*\(\s*new\s+CustomEvent')
    lit_inner_html_pattern = re.compile(r'\.innerHTML\s*=')
    sutram_form_control_pattern = re.compile(r'<(?:input|select|textarea)\b(?!.*type=["\'](?:checkbox|radio|file)["\'])')
    sutram_btn_class_pattern = re.compile(r'<button\b[^>]*class=["\'][^"\'\n]*\bbtn-sm\b')
    sutram_btn_label_pattern = re.compile(r'<sutram-btn\b(?!.*label=)[^>]*>[^<]+\S')
    sutram_card_intent_color_pattern = re.compile(r'<(?:sutram-card|sutram-column)\b[^>]*\bintentColor=')
    sutram_inline_style_pattern = re.compile(r'<sutram-[a-z0-9-]+\b[^>]*\bstyle\s*=')
    sutram_raw_scale_prop_pattern = re.compile(
        r'<sutram-(?:stack|view|modal|toolbar|surface|textarea|label|composer)\b[^>]*\b(?:minColWidth|maxWidth|max-width|bottomBorder|minRows|maxHeight|borderless|preWrap|strikethrough|radius|minHeight|min-height|position|width|alignSelf|align-self)\b'
        r'|\.(?:minColWidth|maxWidth|bottomBorder|minRows|maxHeight)\s*='
    )
    bind_store_input_style_pattern = re.compile(r'bindStoreInput\s*\([^)]*?\bstyle\s*:')
    legacy_scale_token_pattern = re.compile(
        r'<sutram-(?:view|modal|btn|async-btn)\b[^>]*\bsize=["\'](?:xs|sm|md|lg|xl)["\']'
        r'|<sutram-stack\b[^>]*\bcolumns=["\'](?:xs|sm|md|lg)["\']'
        r'|<sutram-pill\b[^>]*\?small='
    )
    legacy_batch_actions_pattern = re.compile(r'\bbatchActions\s*:')
    raw_scale_assignment_pattern = re.compile(r'\.(?:minColWidth|maxWidth|bottomBorder|minRows|maxHeight)\s*=')
    declared_properties = load_declared_properties()

    # Layout and Environmental Constraints
    media_layout_pattern = re.compile(r'@media\s*\([^)]*(?:width|height)[^)]*\)')
    banned_cdn_import_pattern = re.compile(r'from\s+[\'"]https?://(esm\.sh|cdn\.jsdelivr\.net|unpkg\.com)')
    banned_yenvui_tag_pattern = re.compile(r'<\/?yenvui-')
    banned_yv_icon_tag_pattern = re.compile(r'<\/?yv-icon\b')
    banned_has_actions_pattern = re.compile(r'\bhas-actions\b')
    subscribe_without_sutram_pattern = re.compile(r'this\.subscribe\s*\(')
    host_domain_leak_pattern = re.compile(r'\bwindow\.inSetu\b|[\'"]insetu-[a-z0-9-]+[\'"]')
    for root, dirs, files in os.walk(target_dir):
        for ignore_dir in ("vendor", "node_modules", ".git"):
            if ignore_dir in dirs:
                dirs.remove(ignore_dir)
        for file in files:
            if not file.endswith(".js"): 
                continue
            
            filepath = Path(root) / file
            
            with open(filepath, "r", encoding="utf-8") as f:
                lines = f.readlines()
            full_text = "".join(lines)

            # Tag-level rules run on whole tags, so attributes on later lines of a multi-line tag are checked too.
            for tag, tag_line, attrs, names in iter_sutram_tags(full_text):
                tag_text = f"<{tag} {attrs}>"

                def report_tag(rule, msg):
                    nonlocal violations_found
                    violations_found += 1
                    print(f"❌ [VIOLATION: {rule}] {filepath.as_posix()}:{tag_line}\n   ↳ {msg}\n")

                if sutram_card_intent_color_pattern.search(tag_text):
                    report_tag("SUTRAM_CARD_INTENT_TOKEN_MANDATE", "Deprecated intentColor detected on <sutram-card> or <sutram-column>. Use semantic intent=\"primary|warning|...\" token property.")
                if sutram_inline_style_pattern.search(tag_text):
                    report_tag("SUTRAM_INLINE_STYLE_BAN", "Inline style='...' attribute detected on a <sutram-*> element. Use semantic properties (?grow, ?fullWidth, ?compact, ?flush, size, columns) instead.")
                if sutram_raw_scale_prop_pattern.search(tag_text):
                    report_tag("SUTRAM_SEMANTIC_PROP_MANDATE", "Banned raw dimension/border property (minColWidth, maxWidth, max-width, bottomBorder) detected on <sutram-*>. Use semantic size='compact|normal|wide|full', columns='compact|normal|wide', or ?flush=${true}.")
                if legacy_scale_token_pattern.search(tag_text):
                    report_tag("UNIFIED_SCALE_TOKEN_MANDATE", "Legacy T-shirt scale token (xs/sm/md/lg/xl or ?small) detected. Migrate to 'none | compact | normal | wide | full' or '?compact=${true}'.")
                for binding in undeclared_bindings(tag, names, declared_properties):
                    report_tag("SUTRAM_UNDECLARED_PROPERTY", f"<{tag}> has no property for '{binding}', so the binding does nothing. Use a property the component declares (see docs/yenvui_contracts.md).")
            for vlist_match in re.finditer(r'<sutram-virtual-list\b[\s\S]*?</sutram-virtual-list>', full_text):
                vlist_block = vlist_match.group(0)
                card_tags = re.findall(r'<sutram-card\b', vlist_block)
                if len(card_tags) > 1:
                    line_no = full_text[:vlist_match.start()].count('\n') + 1
                    violations_found += 1
                    print(
                        f"❌ [VIOLATION: VIRTUAL_LIST_SINGLE_CARD_TEMPLATE_MANDATE] {filepath.as_posix()}:{line_no}\n"
                        f"   ↳ Multiple <sutram-card> template branches detected inside a single <sutram-virtual-list>. "
                        f"Normalize item variables and return a single <sutram-card> TemplateResult to prevent DOM recycling property drift.\n"
                    )

            is_lit_component = any(re.search(r'from\s+[\'"]lit[\'"]', l) for l in lines)
            extends_sutram_element = any(
                re.search(r'extends\s+(?:SutramElement|InSetuElement|SutramContextMixin\b)', l)
                for l in lines
            )
            in_class_body = False

            for i, line in enumerate(lines):
                line_num = i + 1
                if line.strip().startswith("//"): 
                    continue
                if re.search(r'^\s*(?:export\s+)?class\s+\w+\s+extends\s+', line):
                    in_class_body = True
                elif re.search(r'\bcustomElements\.define\s*\(', line) or re.match(r'^\}\s*$', line):
                    in_class_body = False
                
                def report(rule, msg):
                    nonlocal violations_found
                    violations_found += 1
                    print(f"❌ [VIOLATION: {rule}] {filepath.as_posix()}:{line_num}\n   ↳ {msg}\n")

                # State Management & UDF
                if dom_read_pattern.search(line):
                    report("DOM_READ_BAN", "Direct DOM reading detected. Read from the centralized Zustand Store instead.")
                
                if interval_pattern.search(line):
                    report("METRONOME_MANDATE", "Raw setInterval detected. Use ExtensionRegistry.registerTick() or the central Poller to prevent ghost memory leaks.")
                if clear_timeout_pattern.search(line) and "utils.debounce" not in line and "Timer" not in line and "panicTimeout" not in line:
                    report("DEBOUNCE_MANDATE", "Raw clearTimeout detected. Use window.ExtensionRegistry.utils.debounce() for safe input throttling.")

                if raw_fetch_pattern.search(line):
                    report("EXPLICIT_API_MANDATE", "Raw fetch() detected. Route network requests strictly through the explicit API SDK wrapper.")

                # DOM Mutability
                if dom_annihilation_pattern.search(line):
                    report("SURGICAL_DOM_MANDATE", "DOM annihilation detected. Use surgical layout reconciliation instead of clearing .innerHTML directly.")
                if is_lit_component and in_class_body and imperative_dom_create_pattern.search(line):
                    report("IMPERATIVE_DOM_CREATION", "document.createElement detected in a LitElement. Construct templates declaratively using lit-html.")

                if is_lit_component and in_class_body and global_listener_pattern.search(line):
                    report("GLOBAL_LISTENER_MANDATE", "Raw window.addEventListener detected. Use this.registerGlobalListener() to guarantee teardown on unmount.")
                if is_lit_component and in_class_body and global_dispatch_pattern.search(line):
                    report("CUSTOM_EVENT_DISPATCH_MANDATE", "Raw window.dispatchEvent detected. Route through this.dispatch(eventName, detail) for streamlined telemetry.")

                if is_lit_component and lit_inner_html_pattern.search(line):
                    report("LIT_INNER_HTML_BAN", "Direct '.innerHTML=' assignment in Lit component detected. Render text nodes declaratively using Lit interpolation.")

                if is_lit_component and sutram_form_control_pattern.search(line):
                    report("SUTRAM_FORM_CONTROL_MANDATE", "Native HTML form control (<input>, <select>, <textarea>) detected in Lit template. Use <sutram-input>, <sutram-select>, <sutram-textarea>, <sutram-toggle>, <sutram-combobox>, or <sutram-target-binding>.")

                if is_lit_component and sutram_btn_class_pattern.search(line):
                    report("SUTRAM_BUTTON_MANDATE", "Raw <button class=\"btn-sm\"> detected in Lit template. Use <sutram-btn> or <sutram-async-btn>.")

                if is_lit_component and sutram_btn_label_pattern.search(strip_lit_expressions(line)) and 'slot=' not in line:
                    report("SUTRAM_BUTTON_DECLARATIVE_LABEL_MANDATE", "Raw text child detected in <sutram-btn>. Use declarative label=\"...\" property attribute.")

                if raw_scale_assignment_pattern.search(line):
                    report("SUTRAM_SEMANTIC_PROP_MANDATE", "Banned raw dimension/border property (minColWidth, maxWidth, bottomBorder, minRows, maxHeight) assigned on a Sutram element. Use semantic size, columns, or ?flush=${true}.")

                if bind_store_input_style_pattern.search(line):
                    report("SUTRAM_BIND_STORE_INPUT_STYLE_BAN", "Passing raw 'style:' in bindStoreInput options is banned. Pass 'grow: true', 'flush: true', or 'inline: true' instead.")

                if legacy_batch_actions_pattern.search(line):
                    report("LEGACY_BATCH_ACTIONS_BAN", "Deprecated 'batchActions' schema array detected. Migrate bulk actions directly into 'entityActions' using 'bulkable: true' (ADR 0061).")

                # Layout Physics & Theme Safety
                if hex_color_pattern.search(line) and ("style=" in line or "cssText" in line):
                    report("THEME_TOKENS", "Hardcoded HEX color found. Use semantic CSS intent variables (e.g., var(--intent-primary)).")

                if media_layout_pattern.search(line):
                    report("CONTAINER_QUERY_MANDATE", "Responsive layout via @media viewport boundaries detected. Utilize @container queries for component-level elasticity.")
                if banned_cdn_import_pattern.search(line):
                    report("BANNED_CDN_IMPORT", "Hardcoded external CDN import detected. All packages must be mapped through local vendor topologies.")

                if banned_has_actions_pattern.search(line):
                    report("BANNED_HAS_ACTIONS_ATTRIBUTE", "The 'has-actions' attribute is deprecated. Card components automatically mount the action tray via the ExtensionRegistry.")
                if subscribe_without_sutram_pattern.search(line) and not extends_sutram_element:
                    report("SUTRAM_ELEMENT_SUBSCRIPTION_MANDATE", "Components using 'this.subscribe()' must extend 'SutramElement' to guarantee automated teardown in disconnectedCallback().")

                if banned_yenvui_tag_pattern.search(line):
                    report("BANNED_YENVUI_TAG_MANDATE", "Direct usage of '<yenvui-*>' tag detected. Consume state-aware 'sutram-' primitives or project via HTML slots.")

                if banned_yv_icon_tag_pattern.search(line):
                    report("BANNED_YV_ICON_TAG_BAN", "Direct '<yv-icon>' chassis tag detected. Use '<sutram-icon>' or semantic icon='...' properties instead.")

                if not allow_host_globals and host_domain_leak_pattern.search(line):
                    report("HOST_DOMAIN_DECOUPLING", "Host domain reference detected (window.inSetu or 'insetu-*'). All host interactions must route through ExtensionRegistry UI hooks.")

    return violations_found

def check_host_domain_decoupling(target_dir="sutram/js"):
    """
    Fitness Function: Enforces pure host-neutral Inversion of Control.
    Verifies that kernel runtime elements (sutram/js, yenvui/js) do not contain
    hardcoded host globals (e.g., window.inSetu) or host component tags ('insetu-*').
    """
    print(f"🔍 Sweeping Host Domain Decoupling (IoC Fitness Function) in {target_dir}...")
    violations_found = 0
    host_leak_pattern = re.compile(r'\bwindow\.inSetu\b|[\'"]insetu-[a-z0-9-]+[\'"]')

    for root, _, files in os.walk(target_dir):
        for file in files:
            if not file.endswith(".js"):
                continue
            filepath = Path(root) / file
            with open(filepath, "r", encoding="utf-8") as f:
                for line_num, line in enumerate(f, 1):
                    if line.strip().startswith("//"):
                        continue
                    if host_leak_pattern.search(line):
                        violations_found += 1
                        print(f"❌ [VIOLATION: HOST_DOMAIN_DECOUPLING] {filepath.as_posix()}:{line_num}\n   ↳ Host domain reference detected. Route strictly through ExtensionRegistry UI hooks.\n")
    return violations_found

if __name__ == "__main__":
    target = sys.argv[1] if len(sys.argv) > 1 else "."
    violations = run_consumer_lint(target)

    if Path("sutram/js").exists():
        violations += check_host_domain_decoupling("sutram/js")
    if Path("yenvui/js").exists():
        violations += check_host_domain_decoupling("yenvui/js")

    if violations == 0:
        print("✅ SUCCESS: Codebase complies with Sutram UI/UDF standards.")
        sys.exit(0)
    else:
        print(f"❌ FAILED: Found {violations} architectural violations.")
        sys.exit(1)