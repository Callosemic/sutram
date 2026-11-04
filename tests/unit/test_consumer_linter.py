import contextlib
import io
import tempfile
import unittest
from pathlib import Path

from tests.sutram_consumer_linter import load_declared_properties, run_consumer_lint, strip_lit_expressions, undeclared_bindings


ICON_BUTTON_WITH_ARROW_HANDLER = (
    '<sutram-btn ?compact=${true} icon="chevron-up" ?disabled=${idx === 0} '
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

    def test_inline_style_and_raw_dimension_props_on_sutram_elements_are_flagged(self):
        self.assertIn(
            "SUTRAM_INLINE_STYLE_BAN",
            self._lint('<sutram-btn label="Go" style="width: 100%;"></sutram-btn>'),
        )
        self.assertIn(
            "SUTRAM_SEMANTIC_PROP_MANDATE",
            self._lint('<sutram-stack direction="grid" minColWidth="180px"></sutram-stack>'),
        )
        self.assertIn(
            "SUTRAM_CARD_INTENT_TOKEN_MANDATE",
            self._lint('<sutram-column titleText="Done" intentColor="var(--intent-success)"></sutram-column>'),
        )
        self.assertNotIn(
            "SUTRAM_INLINE_STYLE_BAN",
            self._lint('<sutram-btn label="Go" ?fullWidth=${true} ?compact=${true}></sutram-btn>'),
        )
        self.assertIn(
            "UNIFIED_SCALE_TOKEN_MANDATE",
            self._lint('<sutram-btn size="sm" label="Legacy"></sutram-btn>'),
        )
        self.assertIn(
            "UNIFIED_SCALE_TOKEN_MANDATE",
            self._lint('<sutram-stack direction="grid" columns="sm"></sutram-stack>'),
        )
        self.assertIn(
            "UNIFIED_SCALE_TOKEN_MANDATE",
            self._lint('<sutram-pill ?small=${true} labelText="Tag"></sutram-pill>'),
        )



class TestConsumerLinterWholeTags(unittest.TestCase):
    """Tag-level rules read whole tags, including attributes on later lines and bindings Lit resolves."""

    def _lint(self, template):
        with tempfile.TemporaryDirectory() as tmp:
            Path(tmp, "demo.js").write_text(
                "import { html } from 'lit';\n"
                "export class Demo {\n"
                f"    render() {{ return html`{template}`; }}\n"
                "}\n",
                encoding="utf-8",
            )
            buf = io.StringIO()
            with contextlib.redirect_stdout(buf):
                run_consumer_lint(tmp)
            return buf.getvalue()

    def test_scale_token_on_a_later_line_of_the_tag_is_flagged(self):
        self.assertIn("UNIFIED_SCALE_TOKEN_MANDATE", self._lint('<sutram-btn\n    size="sm"\n    label="Copy"></sutram-btn>'))

    def test_undeclared_property_binding_is_flagged(self):
        output = self._lint('<sutram-stack\n    direction="col"\n    .notAProperty=${1}></sutram-stack>')
        self.assertIn("SUTRAM_UNDECLARED_PROPERTY", output)
        self.assertIn(".notAProperty", output)

    def test_declared_bindings_and_quoted_markup_pass(self):
        output = self._lint(
            '<sutram-card .filename=${f} titleText="A <b>bold</b> > title" ?disableSelection=${true}\n'
            '    @card-clicked=${() => go(x > 1)} slot="item" data-id="1"></sutram-card>'
        )
        self.assertNotIn("SUTRAM_UNDECLARED_PROPERTY", output)

    def test_boolean_binding_must_match_the_reflected_attribute(self):
        declared = {"sutram-demo": {"wide": "wide", "drawerOpen": "drawer-open"}}
        self.assertEqual(undeclared_bindings("sutram-demo", "?wide=${} ?drawerOpen=${}", declared),
                        ["?drawerOpen (the property's attribute is 'drawer-open')"])

    def test_declared_properties_follow_mixins_aliases_and_passthrough_tags(self):
        declared = load_declared_properties()
        self.assertIn("label", declared["sutram-input"])
        self.assertIn("drawerOpen", declared["sutram-sidebar-layout"])
        self.assertIn("filename", declared["sutram-card"])
        self.assertIn("name", declared["sutram-icon"])


if __name__ == "__main__":
    unittest.main()
