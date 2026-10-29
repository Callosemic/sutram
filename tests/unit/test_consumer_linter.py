import contextlib
import io
import tempfile
import unittest
from pathlib import Path

from tests.sutram_consumer_linter import run_consumer_lint, strip_lit_expressions


ICON_BUTTON_WITH_ARROW_HANDLER = (
    '<sutram-btn size="sm" icon="chevron-up" ?disabled=${idx === 0} '
    '@click=${e => { e.stopPropagation(); this._moveItem(idx, -1); }}></sutram-btn>'
)
RAW_TEXT_BUTTON = '<sutram-btn intent="primary" @click=${() => this.save()}>Save</sutram-btn>'
LABELLED_BUTTON = '<sutram-btn intent="primary" label="Save" @click=${() => this.save()}></sutram-btn>'


class TestConsumerLinterButtonLabels(unittest.TestCase):
    """SUTRAM_BUTTON_DECLARATIVE_LABEL_MANDATE must ignore '=>' and '>' inside Lit ${...} bindings."""

    def test_strip_lit_expressions_removes_bindings_whole(self):
        self.assertEqual(
            strip_lit_expressions('<a @click=${e => { if (x > 1) { go(); } }}>x</a>'),
            '<a @click=${}>x</a>',
        )
        self.assertEqual(strip_lit_expressions("plain text"), "plain text")
        self.assertEqual(strip_lit_expressions("open ${ never closed"), "open ${}")

    def _lint(self, template_line):
        with tempfile.TemporaryDirectory() as tmp:
            Path(tmp, "demo.js").write_text(
                "import { html } from 'lit';\n"
                "export class Demo {\n"
                f"    render() {{ return html`{template_line}`; }}\n"
                "}\n",
                encoding="utf-8",
            )
            buf = io.StringIO()
            with contextlib.redirect_stdout(buf):
                run_consumer_lint(tmp)
            return buf.getvalue()

    def test_icon_only_button_with_arrow_handler_is_not_flagged(self):
        self.assertNotIn("SUTRAM_BUTTON_DECLARATIVE_LABEL_MANDATE", self._lint(ICON_BUTTON_WITH_ARROW_HANDLER))

    def test_raw_text_child_is_still_flagged(self):
        self.assertIn("SUTRAM_BUTTON_DECLARATIVE_LABEL_MANDATE", self._lint(RAW_TEXT_BUTTON))

    def test_declarative_label_is_accepted(self):
        self.assertNotIn("SUTRAM_BUTTON_DECLARATIVE_LABEL_MANDATE", self._lint(LABELLED_BUTTON))


if __name__ == "__main__":
    unittest.main()
