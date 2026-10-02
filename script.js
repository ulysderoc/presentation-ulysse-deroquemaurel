/* ============================================================
   Portfolio chronologique — trait de stylo plume
   ============================================================ */
(() => {
  const SVG_NS = "http://www.w3.org/2000/svg";
  const timeline = document.getElementById("timeline");
  const svg = document.getElementById("ink");
  const chapters = [...document.querySelectorAll(".chapter")];
  const entries = [...document.querySelectorAll(".entry")];
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let buildTimer = null;
  const INK = getComputedStyle(document.documentElement).getPropertyValue("--ink").trim() || "#16213a";

  /* ---------- Images manquantes → cadre vide ---------- */
  document.querySelectorAll("img").forEach((img) => {
    const fail = () => {
      const ph = document.createElement("div");
      ph.className = "placeholder";
      ph.textContent = "Photo à ajouter\n" + img.getAttribute("src");
      ph.style.whiteSpace = "pre-line";
      img.replaceWith(ph);
      scheduleBuild();
    };
    if (img.complete && img.naturalWidth === 0) fail();
    else img.addEventListener("error", fail, { once: true });
    img.addEventListener("load", scheduleBuild, { once: true });
  });

  /* ---------- Petits dessins montagne ----------
     Trait unique, épais, angles nets : dans l'esprit du logo Simond.
     Chaque tracé est dessiné à l'apparition (pathLength = 1).          */
  const DOODLES = {
    montagne: `
      <path d="M2 54 L22 22 L30 34 L42 14 L62 54 Z"/>
      <path d="M36 24 L40 28 L43 24 L46 28 L48 26"/>`,
    chaussure: `
      <path d="M14 8 L30 8 L31 28 L50 36 L58 40 L58 50 L8 50 L8 38 Z"/>
      <path d="M8 44 L58 44"/>
      <path d="M24 14 L31 14 M23 20 L31 20 M23 26 L33 28"/>
      <path d="M12 50 L12 55 M22 50 L22 55 M32 50 L32 55 M42 50 L42 55 M52 50 L52 55"/>`,
    ski: `
      <path d="M8 56 L50 14 L58 12"/>
      <path d="M14 58 L54 18 L60 16"/>
      <path d="M10 10 L48 48"/>
      <path d="M43 53 L53 43"/>`,
    piolet: `
      <path d="M22 58 L48 10"/>
      <path d="M34 6 L58 18 L56 22"/>
      <path d="M34 6 Q 20 10 10 24"/>
      <path d="M22 58 L20 62"/>`,
    crampon: `
      <path d="M4 18 L4 28 L46 28 L58 36"/>
      <path d="M40 28 L46 18 L52 22"/>
      <path d="M10 28 L8 40 M20 28 L18 40 M30 28 L28 40 M40 28 L38 40"/>
      <path d="M50 31 L52 42 M58 36 L64 38"/>`,
    chamois: `
      <path d="M14 30 L44 30 L48 22 L56 26 L52 30 L46 36 L46 52"/>
      <path d="M48 22 L49 12 L45 8"/>
      <path d="M47 25 L43 23"/>
      <path d="M14 30 L11 26"/>
      <path d="M16 30 L20 40 L42 40"/>
      <path d="M20 40 L18 52 M26 40 L28 52 M40 40 L38 52"/>
      <path d="M8 58 L24 54 L40 56 L58 52"/>`,
    tente: `
      <path d="M6 52 L32 12 L58 52 Z"/>
      <path d="M24 52 L32 32 L40 52"/>
      <path d="M32 12 L32 6 M2 52 L62 52"/>`
  };

  const doodleIO = new IntersectionObserver((items) => {
    items.forEach((it) => {
      if (it.isIntersecting) { it.target.classList.add("drawn"); doodleIO.unobserve(it.target); }
    });
  }, { rootMargin: "0px 0px -15% 0px" });

  document.querySelectorAll("[data-doodle]").forEach((host) => {
    const shape = DOODLES[host.dataset.doodle];
    if (!shape) return;
    const span = document.createElement("span");
    span.className = "doodle doodle-" + host.dataset.doodle;
    span.setAttribute("aria-hidden", "true");
    span.innerHTML = `<svg viewBox="0 0 64 64">${shape}</svg>`;
    span.querySelectorAll("path").forEach((p) => p.setAttribute("pathLength", "1"));
    const target = host.querySelector(".chapter-head") || host;
    target.prepend(span);
    // Les dessins de la frise se tracent avec le trait (voir render) ;
    // seul celui de l'intro, au-dessus du trait, attend d'être à l'écran.
    if (host.classList.contains("intro")) doodleIO.observe(span);
  });

  /* ---------- Alternance gauche / droite ---------- */
  entries.forEach((e, i) => e.classList.toggle("flip", i % 2 === 1));

  /* ---------- Sommaire automatique ---------- */
  const tocList = document.getElementById("toc-list");
  const tocLinks = chapters.map((ch) => {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.href = "#" + ch.id;
    a.innerHTML = `<span class="toc-label"></span>`;
    a.querySelector(".toc-label").textContent = ch.dataset.title || ch.id;
    li.appendChild(a);
    tocList.appendChild(li);
    return a;
  });

  /* ---------- Menu mobile ---------- */
  const sidebar = document.getElementById("sidebar");
  const toggle = document.getElementById("menu-toggle");
  toggle.addEventListener("click", () => {
    const open = sidebar.classList.toggle("open");
    toggle.setAttribute("aria-expanded", open);
  });
  tocLinks.forEach((a) => a.addEventListener("click", () => {
    sidebar.classList.remove("open");
    toggle.setAttribute("aria-expanded", "false");
  }));

  /* ============================================================
     Construction du trait
     ============================================================ */
  let mainPath, shadowPath, nodes = [], totalLength = 0;
  let drawn = 0, target = 0, rafId = null;

  // Pseudo-aléatoire stable : le trait garde la même forme à chaque chargement
  const rand = (i) => {
    const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
    return x - Math.floor(x);
  };

  // Position verticale dans la frise, sans tenir compte des animations (transform)
  function relTop(el) {
    let y = 0;
    for (let n = el; n && n !== timeline; n = n.offsetParent) y += n.offsetTop;
    return y;
  }

  function build() {
    const w = timeline.offsetWidth;
    const h = timeline.offsetHeight;
    const mobile = matchMedia("(max-width: 900px)").matches;
    const gutter = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--gutter"));
    const cx = mobile ? gutter / 2 : w / 2;
    const amp = mobile ? 9 : gutter * 0.3;

    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    svg.setAttribute("height", h);
    svg.innerHTML = "";

    // Points de passage : titres de chapitres + chaque étape
    const anchors = [];
    chapters.forEach((ch) => {
      const head = ch.querySelector(".chapter-head");
      anchors.push({ y: relTop(head) + head.offsetHeight / 2, type: "chapter", el: head });
      ch.querySelectorAll(".entry").forEach((e) => {
        anchors.push({ y: relTop(e) + 14, type: "entry", el: e });
      });
    });
    anchors.sort((a, b) => a.y - b.y);

    const pts = [{ x: cx, y: 0 }, ...anchors.map((a) => ({ ...a, x: cx })), { x: cx, y: h - 40 }];

    // Courbes en S entre chaque point : un trait de plume qui ondule
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) {
      const p0 = pts[i - 1], p1 = pts[i];
      const dy = p1.y - p0.y;
      const s = (i % 2 ? 1 : -1) * amp * (0.6 + rand(i) * 0.6);
      const c1x = p0.x + s, c1y = p0.y + dy * (0.3 + rand(i + 50) * 0.1);
      const c2x = p1.x - s * (0.7 + rand(i + 99) * 0.5), c2y = p0.y + dy * (0.68 + rand(i + 7) * 0.1);
      d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p1.x} ${p1.y}`;
    }

    // Deux tracés superposés pour imiter l'encre (épaisseur irrégulière)
    shadowPath = el("path", { d, class: "ink-shadow", fill: "none", stroke: INK,
      "stroke-width": 4.2, "stroke-opacity": 0.18, "stroke-linecap": "round",
      transform: "translate(0.8 0)" });
    mainPath = el("path", { d, fill: "none", stroke: INK,
      "stroke-width": 2.2, "stroke-linecap": "round" });
    svg.append(shadowPath, mainPath);

    totalLength = mainPath.getTotalLength();
    [mainPath, shadowPath].forEach((p) => {
      p.style.strokeDasharray = `${totalLength} ${totalLength}`;
    });

    // Taches d'encre sur chaque étape / chapitre
    nodes = anchors.map((a, i) => {
      const g = el("g", { class: "node", transform: `translate(${cx} ${a.y})`, opacity: 0 });
      if (a.type === "chapter") {
        g.append(
          el("circle", { r: 9, fill: "none", stroke: INK, "stroke-width": 1.4 }),
          el("circle", { r: 4.2, fill: INK })
        );
      } else {
        const r = 5 + rand(i) * 1.5;
        g.append(
          el("ellipse", { rx: r, ry: r * 0.86, fill: INK, transform: `rotate(${rand(i + 3) * 180})` }),
          el("circle", { r: 1.6, cx: r * 0.9, cy: r * 0.7, fill: INK, opacity: 0.7 })
        );
      }
      g.style.transition = "opacity .4s ease";
      svg.append(g);
      return { g, y: a.y, el: a.el, shown: null };
    });

    target = computeTarget();
    if (reduceMotion) drawn = target;
    render();
  }

  function el(name, attrs) {
    const n = document.createElementNS(SVG_NS, name);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }

  /* ---------- Avancement en fonction du défilement ---------- */
  function computeTarget() {
    if (!mainPath) return 0;
    const top = timeline.getBoundingClientRect().top;
    const yWanted = window.innerHeight * 0.62 - top;
    if (yWanted <= 0) return 0;
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) return totalLength;
    // Recherche dichotomique de la longueur dont le point atteint yWanted
    let lo = 0, hi = totalLength;
    for (let i = 0; i < 22; i++) {
      const mid = (lo + hi) / 2;
      if (mainPath.getPointAtLength(mid).y < yWanted) lo = mid; else hi = mid;
    }
    return lo;
  }

  function render() {
    if (!mainPath) return;
    const off = totalLength - drawn;
    mainPath.style.strokeDashoffset = off;
    shadowPath.style.strokeDashoffset = off;

    const p = mainPath.getPointAtLength(drawn);
    const done = drawn >= totalLength - 1;

    // Le texte, les titres et les dessins apparaissent quand le trait les atteint
    nodes.forEach((n) => {
      const show = p.y >= n.y - 1 || done;
      if (show !== n.shown) {
        n.g.setAttribute("opacity", show ? 1 : 0);
        reveal(n.el, show);
        n.shown = show;
      }
    });
    reveal(signature, done);
  }

  const signature = document.querySelector(".signature");
  function reveal(target, show) {
    if (!target) return;
    target.classList.toggle("visible", show);
    const doodle = target.querySelector(".doodle");
    if (doodle) doodle.classList.toggle("drawn", show);
  }

  function loop() {
    const diff = target - drawn;
    drawn += diff * 0.12;
    if (Math.abs(diff) < 0.5) drawn = target;
    render();
    rafId = drawn === target ? null : requestAnimationFrame(loop);
  }

  function onScroll() {
    target = computeTarget();
    if (reduceMotion) { drawn = target; render(); return; }
    if (!rafId) rafId = requestAnimationFrame(loop);
    updateActiveToc();
  }

  /* ---------- Chapitre actif dans le sommaire ---------- */
  function updateActiveToc() {
    const line = window.innerHeight * 0.35;
    let current = 0;
    chapters.forEach((ch, i) => { if (ch.getBoundingClientRect().top <= line) current = i; });
    tocLinks.forEach((a, i) => a.classList.toggle("active", i === current));
  }

  /* ---------- Reconstruction quand la mise en page change ---------- */
  function scheduleBuild() {
    clearTimeout(buildTimer);
    buildTimer = setTimeout(() => { build(); onScroll(); }, 80);
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", scheduleBuild);
  new ResizeObserver(scheduleBuild).observe(timeline);
  if (document.fonts) document.fonts.ready.then(scheduleBuild);

  build();
  updateActiveToc();
})();
