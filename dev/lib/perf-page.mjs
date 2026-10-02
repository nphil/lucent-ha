/** What the perf gate installs inside the page (`page.addInitScript(installProbe)`): `window.__perf`. It records raw facts (when the DOM changed, which
 * frames had an animation running, long tasks, layout shifts) and finds the controls of the sample panel; every judgement happens in Node
 * (dev/lib/perf-settle.ts, perf-trace.ts, perf-budgets.ts). The function is serialised into the page: it must not use anything from this file's scope. */

export function installProbe() {
  const P = (window.__perf = { armed: false, mut: [], where: [], images: [], shifts: [], shiftsAll: [], longTasks: [], loaf: [], session: null, pressPromise: null });
  const now = () => performance.now();
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
  const demo = () => window.__lu && window.__lu.demo;

  // ---- where things are -------------------------------------------------------------------------------------------------------------
  let panelEl = null;
  const panel = () => {
    if (!panelEl || !panelEl.isConnected) panelEl = window.__lu ? window.__lu.query("spec-demo-panel") : null;
    return panelEl;
  };
  const root = () => (panel() ? panel().renderRoot : null);
  const view = (id) => (root() ? root().querySelector(`[data-view="${id}"]`) : null);
  const current = () => (demo() ? view(demo().current()) : null);
  const openSheet = () => {
    const sheets = root() ? [...root().querySelectorAll("spec-lu-sheet")] : [];
    return sheets.find((sheet) => sheet.open) || null;
  };
  const rectOf = (el) => el.getBoundingClientRect();
  const sized = (el) => {
    const r = rectOf(el);
    return r.width > 0 && r.height > 0;
  };
  const firstSized = (list) => [...list].find(sized) || null;

  /** The controls the gate presses. The name is what the report shows. */
  const finders = {
    "nav-tab": (id) => demo().navItem(id),
    "camera-tile": () => (current() ? firstSized(current().querySelectorAll('[data-demo="camera-tile"]')) : null),
    "picker-button": () => demo().pickerButton(),
    "species-tile": (index) => demo().speciesTile(index || 0),
    "species-more": () => (current() ? current().querySelector('[data-demo="species-more"]') : null),
    "segmented-option": () => {
      const bar = current() ? current().querySelector("spec-lu-segmented") : null;
      const options = bar && bar.shadowRoot ? bar.shadowRoot.querySelectorAll('[role="radio"]') : [];
      return [...options].find((option) => option.getAttribute("aria-checked") !== "true" && sized(option)) || null;
    },
    "insights-button": () => (current() ? firstSized([...current().querySelectorAll("spec-lu-button")].filter((button) => !button.disabled)) : null),
    "insights-row": () => (current() ? firstSized(current().querySelectorAll("spec-lu-row")) : null),
    "sheet-close": () => (openSheet() && openSheet().shadowRoot ? openSheet().shadowRoot.querySelector(".close") : null),
    "shell-heading": () => {
      const shell = root() ? root().querySelector("spec-lu-app-shell") : null;
      return shell && shell.shadowRoot ? shell.shadowRoot.querySelector("h1") : null;
    },
    "sheet-title": () => (openSheet() && openSheet().shadowRoot ? openSheet().shadowRoot.querySelector("#title") : null),
  };
  P.finders = finders;

  /** The element under (x, y), looking through shadow roots. */
  const hits = (el, x, y) => {
    let node = document.elementFromPoint(x, y);
    while (node && node.shadowRoot) {
      const inner = node.shadowRoot.elementFromPoint(x, y);
      if (!inner || inner === node) break;
      node = inner;
    }
    for (let up = node; up; up = up.parentNode || up.host) if (up === el) return true;
    return false;
  };

  const decodeImages = async (el) => {
    const pictures = [];
    const walk = (node) => {
      for (const child of node.querySelectorAll("*")) {
        if (child.tagName === "IMG") pictures.push(child);
        if (child.shadowRoot) walk(child.shadowRoot);
      }
      if (node.tagName === "IMG") pictures.push(node);
    };
    walk(el.shadowRoot || el);
    await Promise.race([Promise.all(pictures.map((image) => image.decode().catch(() => undefined))), sleep(900)]);
  };

  /** Brings a control into view (nearest, never centred unless something covers it), waits for what is in it to be decoded and for the page to be still, and
   * returns the point to press. `null` when the control is not there. */
  P.locate = async (name, arg) => {
    const find = finders[name];
    let el = find ? find(arg) : null;
    if (!el) return null;
    let before = rectOf(el).top;
    el.scrollIntoView({ block: "nearest", inline: "nearest" });
    let scrolled = Math.abs(rectOf(el).top - before) > 1;
    await sleep(scrolled ? 350 : 60);
    await decodeImages(el);
    await frame();
    await frame();
    const point = () => {
      const r = rectOf(el);
      const left = Math.max(r.left, 0);
      const right = Math.min(r.right, innerWidth);
      const top = Math.max(r.top, 0);
      const bottom = Math.min(r.bottom, innerHeight);
      return { x: (left + right) / 2, y: (top + bottom) / 2, w: r.width, h: r.height };
    };
    let at = point();
    if (!hits(el, at.x, at.y)) {
      before = rectOf(el).top;
      el.scrollIntoView({ block: "center", inline: "nearest" });
      scrolled = scrolled || Math.abs(rectOf(el).top - before) > 1;
      await sleep(350);
      await frame();
      await frame();
      at = point();
      if (!hits(el, at.x, at.y)) return { covered: true, ...at, scrolled };
    }
    return { ...at, scrolled };
  };

  // ---- watchers (always on) ---------------------------------------------------------------------------------------------------------
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) P.longTasks.push({ t: entry.startTime, d: entry.duration });
    }).observe({ type: "longtask", buffered: true });
  } catch (error) {
    P.noLongTasks = String(error);
  }
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const scripts = entry.scripts.map((script) => ({ url: script.sourceURL, d: script.duration, fn: script.sourceFunctionName }));
        P.loaf.push({ t: entry.startTime, d: entry.duration, block: entry.blockingDuration, scripts });
      }
    }).observe({ type: "long-animation-frame", buffered: true });
  } catch (error) {
    P.noLoaf = String(error);
  }
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        P.shiftsAll.push({ t: entry.startTime, v: entry.value });
        if (!entry.hadRecentInput) P.shifts.push({ t: entry.startTime, v: entry.value });
      }
    }).observe({ type: "layout-shift", buffered: true });
  } catch (error) {
    P.noShifts = String(error);
  }
  window.addEventListener("lu-image-load", () => { if (P.armed) P.images.push(now()); }, true);

  // DOM changes inside the panel, in every shadow root (a MutationObserver does not look into them by itself: each new root is added to it).
  const inPanel = (node) => {
    for (let up = node; up; up = up.parentNode || up.host) if (up.nodeName === "SPEC-DEMO-PANEL") return true;
    return false;
  };
  const changes = new MutationObserver((records) => {
    if (!P.armed) return;
    // The press mark comes and goes with every tap: it is the finger's feedback, not the screen's answer to the tap.
    const record = records.find((entry) => !(entry.type === "attributes" && entry.attributeName === "data-pressed") && inPanel(entry.target));
    if (!record) return;
    P.mut.push(now());
    if (P.where.length < 20) P.where.push(`${record.type}:${record.target.nodeName}${record.attributeName ? `@${record.attributeName}` : ""}`);
  });
  const watch = (target) => {
    try {
      changes.observe(target, { subtree: true, childList: true, attributes: true, characterData: true });
    } catch {
      /* a node that cannot be observed has nothing to report */
    }
  };
  // `document.getAnimations()` does not look into shadow trees, and nearly everything animates inside one: the roots are kept (weakly) to ask each of them.
  const roots = [];
  const attach = Element.prototype.attachShadow;
  Element.prototype.attachShadow = function attachShadow(init) {
    const shadow = attach.call(this, init);
    watch(shadow);
    roots.push(new WeakRef(shadow));
    return shadow;
  };
  watch(document);

  // ---- recording one tap, sheet opening or Back -------------------------------------------------------------------------------------
  const finiteRunning = (animation) => (animation.playState === "running" || animation.playState === "pending") && Number.isFinite(animation.effect.getComputedTiming().endTime);
  /** Any finite animation or transition is running somewhere on the page (an endless ambient one does not count). */
  const animating = () => {
    try {
      let found = document.getAnimations().some(finiteRunning);
      for (let i = roots.length - 1; i >= 0; i--) {
        const shadow = roots[i].deref();
        if (!shadow || !shadow.host.isConnected) roots.splice(i, 1);
        else if (!found && shadow.getAnimations().some(finiteRunning)) found = true;
      }
      return found;
    } catch {
      return false;
    }
  };
  const inView = (el) => {
    const r = rectOf(el);
    return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight;
  };
  /** Pictures on screen that have not arrived yet (lazy ones below the fold do not count). */
  const pendingImages = () => {
    let count = 0;
    const walk = (node) => {
      for (const child of node.querySelectorAll("*")) {
        if (child.tagName === "IMG" && !child.complete && inView(child)) count += 1;
        if (child.shadowRoot) walk(child.shadowRoot);
      }
    };
    if (root()) walk(root());
    return count;
  };
  const sheetState = (sheet) => {
    const shadow = sheet && sheet.shadowRoot;
    const dialog = shadow ? shadow.querySelector("dialog") : null;
    const part = shadow ? shadow.querySelector(".panel") : null;
    if (!dialog || !part) return null;
    const running = [...shadow.querySelectorAll(".scrim, .panel")].some((el) => el.getAnimations().some((animation) => animation.playState === "running" || animation.playState === "pending"));
    return {
      shown: dialog.open,
      // The enter motion is over and the panel is fully opaque.
      settled: dialog.open && !running && getComputedStyle(part).opacity === "1",
      // The exit has begun: the sheet was told to close, or its exit motion started, or the dialog is gone.
      closing: !sheet.open || dialog.hasAttribute("data-leaving") || !dialog.open,
    };
  };
  const lastOf = (list) => (list.length ? list[list.length - 1] : -Infinity);

  const finish = (s, t, why) => {
    s.ended = true;
    P.armed = false;
    window.removeEventListener("click", s.onClick, true);
    const started = s.t0 === null ? 0 : s.t0;
    s.resolve({
      kind: s.kind, why, t0: s.t0, clicked: s.t0 !== null, until: t, timeOrigin: performance.timeOrigin,
      frames: s.frames, animationFrames: s.animFrames, mutations: P.mut.slice(), images: P.images.slice(), shifts: P.shiftsAll.filter((x) => x.t >= started).map((x) => x.t),
      shiftValue: P.shiftsAll.filter((x) => x.t >= s.startedAt && x.t <= t).reduce((sum, x) => sum + x.v, 0),
      where: P.where.slice(), pending: pendingImages(), visibleAt: s.visible === undefined ? null : s.frames[s.visible + 1] ?? t,
      doneAt: s.done === undefined ? null : s.frames[s.done + 1] ?? t,
      current: demo() ? demo().current() : null, rendersAtStart: s.rendersAtStart, renders: demo() ? demo().stats().renders : null, layers: demo() ? demo().layerDepth() : null,
    });
  };

  /** Starts watching; `kind` is "tab" (settle after a tap), "sheet" (open after a tap) or "back" (closing after history.back or a CDP back). */
  P.begin = (kind) => {
    const s = { kind, t0: null, startedAt: now(), frames: [], animFrames: [], ended: false, sheet: kind === "back" ? openSheet() : null, rendersAtStart: demo() ? demo().stats().renders : null };
    P.session = s;
    P.mut.length = 0;
    P.images.length = 0;
    P.where.length = 0;
    P.armed = true;
    s.promise = new Promise((resolve) => { s.resolve = resolve; });
    s.onClick = (event) => { if (kind !== "back" && s.t0 === null) s.t0 = event.timeStamp; };
    window.addEventListener("click", s.onClick, true);
    const tick = (t) => {
      if (s.ended) return;
      s.frames.push(t);
      if (animating()) s.animFrames.push(t);
      if (kind === "tab") {
        if (s.t0 === null) {
          if (t - s.startedAt > 2500) return finish(s, t, "no-tap");
        } else {
          const last = Math.max(s.t0, lastOf(P.mut), lastOf(s.animFrames), lastOf(P.images));
          if (t - s.t0 >= 3500) return finish(s, t, "cap");
          if (t - s.t0 >= 800 && t - last >= 250 && pendingImages() === 0) return finish(s, t, "quiet");
        }
      } else if (kind === "sheet") {
        if (s.t0 === null) {
          if (t - s.startedAt > 2500) return finish(s, t, "no-tap");
        } else {
          const sheet = s.sheet || (s.sheet = openSheet());
          const state = sheetState(sheet);
          if (state && state.shown && s.visible === undefined) s.visible = s.frames.length - 1;
          if (state && state.settled && s.done === undefined) s.done = s.frames.length - 1;
          if (s.done !== undefined && s.frames.length > s.done + 1) return finish(s, t, "open");
          if (t - s.t0 >= 3000) return finish(s, t, "cap");
        }
      } else {
        const state = sheetState(s.sheet);
        // No tap time needed: with a Back from outside the page (CDP) the page learns its start only afterwards, and the sheet stays closing.
        if (state && state.closing && s.done === undefined) s.done = s.frames.length - 1;
        if (s.done !== undefined && s.frames.length > s.done + 1) return finish(s, t, "closing");
        if (t - s.startedAt >= 4000) return finish(s, t, "cap");
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    return true;
  };
  /** The page's own Back (what the system Back button does to history). */
  P.goBack = () => {
    P.session.t0 = now();
    history.back();
    return P.session.t0;
  };
  /** Back pressed from outside the page (CDP): the wall-clock moment, converted to the page clock. */
  P.markBack = (epochMs) => {
    P.session.t0 = epochMs - performance.timeOrigin;
    return P.session.t0;
  };
  /** The recording, when it is over. The tap time is read now, not when the recording stopped: a Back from outside the page tells the page late. */
  P.end = () => P.session.promise.then((result) => ({ ...result, t0: P.session.t0, clicked: P.session.t0 !== null }));

  // ---- presses ----------------------------------------------------------------------------------------------------------------------
  const look = (node, pseudo) => {
    const style = getComputedStyle(node, pseudo);
    return [style.transform, style.backgroundColor, style.backgroundImage, style.boxShadow, style.opacity, style.filter, style.outlineColor, style.outlineWidth, pseudo ? style.content : "", node.hasAttribute && node.hasAttribute("data-pressed") ? "pressed" : ""].join("|");
  };
  /** What a press can change: the control, its children (shadow roots included) with their ::before/::after veils, and three levels above. */
  const signature = (el) => {
    const parts = [];
    for (let node = el, depth = 0; node && depth < 4; node = node.parentElement || (node.getRootNode() && node.getRootNode().host), depth += 1) parts.push(look(node));
    const below = [];
    const collect = (node) => {
      for (const child of node.children || []) {
        below.push(child);
        if (child.shadowRoot) collect(child.shadowRoot);
        collect(child);
      }
    };
    collect(el.shadowRoot || el);
    if (el.shadowRoot) collect(el);
    for (const node of below.slice(0, 60)) parts.push(look(node), look(node, "::before"), look(node, "::after"));
    parts.push(look(el, "::before"), look(el, "::after"));
    return parts.join("||");
  };
  /** Gets ready to time the next pointerdown on the control: the frame that shows the press is produced between the first and the second animation
   * frame after it, so the second one marks the moment it is on its way to the screen. */
  P.armPress = (name, arg) => {
    const el = finders[name](arg);
    const before = signature(el);
    P.pressPromise = new Promise((resolve) => {
      window.addEventListener("pointerdown", (event) => {
        const down = event.timeStamp;
        requestAnimationFrame(() => requestAnimationFrame(() => resolve({ ms: now() - down, changed: signature(el) !== before })));
      }, { capture: true, once: true });
      setTimeout(() => resolve(null), 4000);
    });
    return true;
  };
  P.pressResult = () => P.pressPromise;
  /** A mouse click that ends a measured press must not use the control. */
  P.muteNextClick = () => window.addEventListener("click", (event) => { event.stopImmediatePropagation(); event.preventDefault(); }, { capture: true, once: true });

  // ---- reading ---------------------------------------------------------------------------------------------------------------------
  P.now = now;
  P.current = () => demo().current();
  P.clsTotal = () => P.shifts.reduce((sum, x) => sum + x.v, 0);
  P.clsAllTotal = () => P.shiftsAll.reduce((sum, x) => sum + x.v, 0);
  /** Everything the observers saw between two page times (the long-task and layout-shift windows of a scroll pass). */
  P.slice = (from, to) => ({
    longTasks: P.longTasks.filter((x) => x.t >= from && x.t <= to).map((x) => Math.round(x.d)),
    loaf: P.loaf.filter((x) => x.t >= from && x.t <= to),
    cls: P.shifts.filter((x) => x.t >= from && x.t <= to).reduce((sum, x) => sum + x.v, 0),
  });
  P.scrollInfo = () => {
    const scroller = document.scrollingElement || document.documentElement;
    return { top: scroller.scrollTop, height: scroller.scrollHeight, viewport: innerHeight };
  };
  P.scrollTo = (top) => {
    (document.scrollingElement || document.documentElement).scrollTo({ top, behavior: "instant" });
    return P.scrollInfo().top;
  };
  P.facts = () => {
    let nodes = 0;
    let images = 0;
    let loaded = 0;
    const walk = (node) => {
      for (const child of node.querySelectorAll("*")) {
        nodes += 1;
        if (child.tagName === "IMG") {
          images += 1;
          if (child.complete && child.naturalWidth > 0) loaded += 1;
        }
        if (child.shadowRoot) walk(child.shadowRoot);
      }
    };
    walk(document);
    const scripts = performance.getEntriesByType("resource").filter((entry) => entry.initiatorType === "script" || /\.js(\?|$)/.test(entry.name));
    const paint = performance.getEntriesByName("first-contentful-paint")[0];
    return {
      nodes, images, imagesLoaded: loaded, scriptBytes: scripts.reduce((sum, entry) => sum + (entry.decodedBodySize || 0), 0),
      firstContentfulPaintMs: paint ? paint.startTime : null, pageErrors: window.__lu ? window.__lu.errors.slice(0, 5) : [],
    };
  };
  P.calibrate = () => {
    const start = now();
    let sum = 0;
    for (let i = 0; i < 30e6; i++) sum += i & 3;
    return Math.round(now() - start) + (sum < 0 ? 1 : 0);
  };
  P.demoReady = async () => {
    const lu = window.__lu;
    if (!lu || !lu.demo) return { ok: false, scenarios: lu && lu.scenarios ? lu.scenarios.map((x) => x.id) : [], problems: lu && lu.problems ? lu.problems.map((x) => `${x.file}: ${x.message}`).slice(0, 5) : [] };
    await lu.demo.ready();
    return { ok: true, readyAt: now() };
  };
}
