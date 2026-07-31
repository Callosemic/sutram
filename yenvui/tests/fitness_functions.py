import re
import glob
def test_theme_token_compliance():
    """Ensure no hardcoded hex/rgb color strings exist in Web Component styles."""
    hex_color_pattern = re.compile(
        r'(?:color|background|border|fill|stroke)\s*:[^;]*?(#[0-9a-fA-F]{3,6}|\bwhite\b|\bblack\b)',
        re.IGNORECASE
    )
    violations = []

    for filepath in glob.glob('js/**/*.js', recursive=True):
        with open(filepath, 'r') as f:
            for idx, line in enumerate(f, start=1):
                if hex_color_pattern.search(line) and 'var(' not in line:
                    violations.append(f"{filepath}:{idx} -> {line.strip()}")

    assert not violations, f"Hardcoded visual style tokens detected:\n" + "\n".join(violations)
def test_custom_event_namespace_compliance():
    """Ensure custom events dispatched by components use the yenvui- or yv- namespace prefix."""
    event_pattern = re.compile(r"new\s+CustomEvent\(\s*['\"]([^'\"]+)['\"]")
    violations = []

    for filepath in glob.glob('js/**/*.js', recursive=True):
        with open(filepath, 'r') as f:
            for idx, line in enumerate(f, start=1):
                match = event_pattern.search(line)
                if match:
                    event_name = match.group(1)
                    if not (event_name.startswith('yenvui-') or event_name.startswith('yv-')):
                        violations.append(f"{filepath}:{idx} -> CustomEvent '{event_name}' lacks 'yenvui-' or 'yv-' prefix")

    assert not violations, f"Un-namespaced custom events detected:\n" + "\n".join(violations)


def test_dialog_host_visibility_compliance():
    """Ensure components utilizing native <dialog> elements do not trap themselves using :host { display: none; }."""
    dialog_pattern = re.compile(r'<dialog\b|\bdialog\s*\{|::backdrop')
    host_none_pattern = re.compile(r':host[^{]*\{\s*display:\s*none')
    violations = []

    for filepath in glob.glob('js/**/*.js', recursive=True):
        with open(filepath, 'r') as f:
            content = f.read()
        if dialog_pattern.search(content):
            for idx, line in enumerate(content.splitlines(), start=1):
                if host_none_pattern.search(line):
                    violations.append(f"{filepath}:{idx} -> :host mapped to display: none in a dialog component")
    assert not violations, f"Native dialog components must use 'display: contents' to prevent top-layer #backdrop UI freezes:\n" + "\n".join(violations)
def test_dialog_teardown_compliance():
    """Ensure components utilizing native <dialog> elements implement disconnectedCallback teardown checks with DOM re-attachment."""
    dialog_pattern = re.compile(r'<dialog\b')
    teardown_pattern = re.compile(r'disconnectedCallback\s*\(\s*\)[\s\S]*?appendChild\([^)]*\)[\s\S]*?dialog\.close\(\)')
    violations = []

    for filepath in glob.glob('js/**/*.js', recursive=True):
        with open(filepath, 'r') as f:
            content = f.read()
        if dialog_pattern.search(content) and not teardown_pattern.search(content):
            violations.append(f"{filepath} -> Wraps native <dialog> but lacks disconnectedCallback unmount close teardown")

    assert not violations, f"Native dialog components must implement disconnectedCallback unmount teardown:\n" + "\n".join(violations)


def test_theme_observer_compliance():
    """Ensure components with custom data-theme CSS rules implement MutationObserver theme tracking."""
    theme_css_pattern = re.compile(r':host\(\[data-theme=')
    observer_pattern = re.compile(r'MutationObserver')
    violations = []

    for filepath in glob.glob('js/**/*.js', recursive=True):
        with open(filepath, 'r') as f:
            content = f.read()

        if theme_css_pattern.search(content) and not observer_pattern.search(content):
            violations.append(f"{filepath} -> Has host data-theme CSS rules but lacks MutationObserver implementation")
    assert not violations, f"Components using :host([data-theme=...]) must implement MutationObserver for document.body data-theme:\n" + "\n".join(violations)


def test_container_query_compliance():
    """Ensure components use @container queries instead of viewport @media queries for component layouts."""
    media_query_pattern = re.compile(r'@media\s*\([^)]*max-width')
    violations = []

    for filepath in glob.glob('js/**/*.js', recursive=True):
        with open(filepath, 'r') as f:
            for idx, line in enumerate(f, start=1):
                if media_query_pattern.search(line):
                    violations.append(f"{filepath}:{idx} -> Viewport @media query detected; use CSS @container query instead")
    assert not violations, f"Viewport-bound @media queries detected in component definitions:\n" + "\n".join(violations)


def test_touchmove_passive_compliance():
    """Ensure components calling e.preventDefault() in touchmove bind listeners with { passive: false }."""
    touchmove_pattern = re.compile(r"addEventListener\(\s*['\"]touchmove['\"]")
    passive_false_pattern = re.compile(r"\{\s*passive\s*:\s*false\s*\}")
    violations = []

    for filepath in glob.glob('js/**/*.js', recursive=True):
        with open(filepath, 'r') as f:
            content = f.read()
        if 'preventDefault()' in content and touchmove_pattern.search(content):
            if not passive_false_pattern.search(content):
                violations.append(f"{filepath} -> Contains touchmove e.preventDefault() but lacks {{ passive: false }} listener binding")

    assert not violations, f"Touchmove cancellation requires {{ passive: false }} event options:\n" + "\n".join(violations)
def test_code_index_no_placeholders():
    """Ensure CODE_INDEX.md has no unpopulated placeholder comments."""
    placeholder_pattern = re.compile(r'#\s*\[comment required\]')
    violations = []

    with open('CODE_INDEX.md', 'r') as f:
        for idx, line in enumerate(f, start=1):
            if placeholder_pattern.search(line):
                violations.append(f"CODE_INDEX.md:{idx} -> Unpopulated comment placeholder")

    assert not violations, f"Unpopulated placeholders found in CODE_INDEX.md:\n" + "\n".join(violations)


def test_flex_grid_min_width_compliance():
    """Ensure flex/grid body containers in Web Components specify min-width: 0 to prevent layout blowouts."""
    flex_grid_pattern = re.compile(r'display:\s*(?:flex|grid)')
    min_width_pattern = re.compile(r'min-width:\s*0')
    violations = []

    for filepath in glob.glob('js/**/*.js', recursive=True):
        with open(filepath, 'r') as f:
            content = f.read()
        if flex_grid_pattern.search(content) and ('class="body"' in content or 'class="card-body"' in content):
            if not min_width_pattern.search(content):
                violations.append(f"{filepath} -> Contains flex/grid body layout but lacks 'min-width: 0' blowout protection")

    assert not violations, f"Flex/grid containers must specify 'min-width: 0':\n" + "\n".join(violations)