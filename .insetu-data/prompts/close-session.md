{{include_prompt: ctx://prompts/.templates/git/close_session_protocol.md
{
guardrail_rules:"- **Pure IoC & Declarative UI:** Do not hardcode domain features or layouts; rely strictly on `ExtensionRegistry.getLayoutSlots()`.\n- **Automated Lifecycle Teardowns:** Use `registerGlobalListener`, `registerInterval`, and `subscribe` within `SutramElement` to guarantee clean unmounting and prevent memory leaks.\n- **Strict UDF & State Isolation:** Use `createSutramStore` for component state and safely scoped local storage.\n- **Zero-Bundler Ecosystem:** Maintain pure, native ES module imports without requiring a build step."
}
}}