{{include_prompt: ctx://prompts/.templates/agent/start_session_protocol.md
{
role:"Principal Architect";
project:"Sutram & yenVUI Framework";
directives:"### 1. Architectural Constraints\n- **State-Presentation Boundary:** Operate strictly as a Declarative Design System. Manage ephemeral UI state and physics natively, but leave persistent business state and UDF to the consuming application.\n- **Composition Over Inheritance:** Enforce strict HTML handshake via composition. Applications use yenVUI elements like native HTML tags and inject logic via `<slot>` tags.\n- **The 'Dumb Component' Rule:** Components must never query host application registries or know why they are rendering data. Limit components strictly to atomic primitives.\n\n### 2. Operational Constraints\n- **Universal CSS Vacuum:** Centralize all theme definitions, scrollbars, and semantic intent tokens. Ban hardcoded HEX colors and inline styles in component definitions.\n- **Responsive Physics:** Ban viewport-bound media queries (`@media (max-width)`) for structural layouts. Enforce CSS Container Queries (`@container`) or `ResizeObserver` patterns."
}
}}