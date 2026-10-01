/** A lean consumer: registers only the elements it uses (`defineElements`), so the bundle contains only those
 * (tree-shaking). Used by `scripts/consumer-test.mjs` to show the size difference and that only
 * `<prefix>-lu-*` tags appear. */
import { LitElement, css } from "lit";
import { html, unsafeStatic } from "lit/static-html.js";
import { BASE_CSS, LuButton, LuChip, TOKENS_CSS, defineElements } from "lucent-ha";

declare const PREFIX: string;

const lu = defineElements(PREFIX, [LuButton, LuChip]);
const tag = (name: string) => unsafeStatic(lu.tag(name));

class LeanPanel extends LitElement {
  static styles = [TOKENS_CSS, BASE_CSS, css`:host { display: block; padding: 16px; }`];

  render() {
    const button = tag("button");
    const chip = tag("chip");
    return html`<${chip} kind="info" label="lean ${PREFIX}"></${chip}> <${button} kind="secondary">Lean</${button}>`;
  }
}
customElements.define(`${PREFIX}-lean-panel`, LeanPanel);
