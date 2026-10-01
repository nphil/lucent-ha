/** A tiny sample consumer of lucent-ha: one panel that registers the toolkit under ITS OWN prefix and renders a few
 * toolkit elements. `PREFIX` is injected by esbuild (`--define:PREFIX='"alpha"'`), so the same file builds the
 * "alpha" and the "beta" consumer used by `scripts/consumer-test.mjs` (two consumers on one page). */
import { LitElement, css } from "lit";
import { html, unsafeStatic } from "lit/static-html.js";
import { BASE_CSS, TOKENS_CSS, defineLucent } from "lucent-ha";

declare const PREFIX: string;

const lu = defineLucent({ prefix: PREFIX });
const tag = (name: string) => unsafeStatic(lu.tag(name));

class SamplePanel extends LitElement {
  static styles = [TOKENS_CSS, BASE_CSS, css`:host { display: block; }`];

  render() {
    const shell = tag("app-shell");
    const section = tag("section");
    const button = tag("button");
    const chip = tag("chip");
    return html`
      <${shell} scroll="contained" heading=${`Sample ${PREFIX}`} current="home"
        .destinations=${[{ id: "home", label: "Home", icon: "M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" }, { id: "more", label: "More", icon: "M12 16a2 2 0 1 1 0 4 2 2 0 0 1 0-4zm0-6a2 2 0 1 1 0 4 2 2 0 0 1 0-4zm0-6a2 2 0 1 1 0 4 2 2 0 0 1 0-4z" }]}>
        <${section} heading="Hello" state="ready" count="1">
          <${chip} kind="positive" label="Registered under ${PREFIX}"></${chip}>
          <${button} kind="primary">Tap</${button}>
        </${section}>
      </${shell}>`;
  }
}
customElements.define(`${PREFIX}-sample-panel`, SamplePanel);
