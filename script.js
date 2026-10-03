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

  /* ---------- Photos et diaporamas ----------
     Plusieurs <img> dans une même <figure class="photo"> = diaporama :
     défilement automatique, flèches, points, glissement du doigt.
     Une image introuvable est retirée ; s'il n'en reste aucune,
     un cadre « Photo à ajouter » s'affiche.                          */
  const AUTOPLAY_MS = 4500;
  const CHEVRON = (d) => `<svg viewBox="0 0 24 24"><path d="${d}"/></svg>`;

  document.querySelectorAll("figure.photo").forEach((fig, figIndex) => {
    const imgs = [...fig.querySelectorAll("img")];
    if (!imgs.length) return;

    const frame = document.createElement("div");
    frame.className = "frame";
    let slides = imgs.map((img) => {
      const s = document.createElement("div");
      s.className = "slide";
      s.append(img);
      frame.append(s);
      return s;
    });
    fig.prepend(frame);

    const prev = document.createElement("button");
    const next = document.createElement("button");
    prev.className = "nav prev"; prev.setAttribute("aria-label", "Photo précédente");
    next.className = "nav next"; next.setAttribute("aria-label", "Photo suivante");
    prev.innerHTML = CHEVRON("M15 5 L8 12 L15 19");
    next.innerHTML = CHEVRON("M9 5 L16 12 L9 19");
    const dots = document.createElement("div");
    dots.className = "dots";

    // Légende sous la photo : suit la photo affichée (data-caption)
    const caption = document.createElement("figcaption");
    fig.append(caption);

    // Étiquettes + flèches dessinées sur la photo (data-note)
    imgs.forEach((img) => {
      if (!img.dataset.note) return;
      if (img.complete && img.naturalWidth) addNote(img);
      else img.addEventListener("load", () => addNote(img), { once: true });
    });

    let index = 0, timer = null, onScreen = false, hovered = false;

    function show(i) {
      if (!slides.length) return;
      index = (i + slides.length) % slides.length;
      slides.forEach((s, k) => s.classList.toggle("active", k === index));
      [...dots.children].forEach((d, k) => d.classList.toggle("active", k === index));
      const text = slides[index].querySelector("img").dataset.caption || "";
      caption.textContent = text;
      caption.hidden = !text;
      fit();
      schedule();
    }

    // Le cadre prend les proportions de la photo affichée
    function fit() {
      const img = slides[index] && slides[index].querySelector("img");
      if (!img || !img.naturalWidth || !frame.isConnected) return;
      const cs = getComputedStyle(frame);
      const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
      const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
      const borderY = parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth);
      const inner = frame.clientWidth - padX;
      frame.style.height = inner * img.naturalHeight / img.naturalWidth + padY + borderY + "px";
    }
    window.addEventListener("resize", fit);

    // Flèches et points seulement s'il reste plusieurs photos
    function refreshControls() {
      const multi = slides.length > 1;
      fig.classList.toggle("carousel", multi);
      if (multi) {
        frame.append(prev, next);
        dots.innerHTML = "";
        slides.forEach((_, k) => {
          const b = document.createElement("button");
          b.setAttribute("aria-label", `Photo ${k + 1} sur ${slides.length}`);
          b.addEventListener("click", () => show(k));
          dots.append(b);
        });
        if (!dots.isConnected) caption.before(dots);
      } else {
        prev.remove(); next.remove(); dots.remove();
      }
    }

    function schedule() {
      clearTimeout(timer);
      if (slides.length < 2 || reduceMotion || !onScreen || hovered || document.hidden) return;
      timer = setTimeout(() => show(index + 1), AUTOPLAY_MS);
    }

    prev.addEventListener("click", () => show(index - 1));
    next.addEventListener("click", () => show(index + 1));
    fig.addEventListener("mouseenter", () => { hovered = true; schedule(); });
    fig.addEventListener("mouseleave", () => { hovered = false; schedule(); });
    document.addEventListener("visibilitychange", schedule);

    // Glisser du doigt sur mobile
    let startX = null;
    frame.addEventListener("pointerdown", (e) => { startX = e.clientX; });
    frame.addEventListener("pointerup", (e) => {
      if (startX === null || slides.length < 2) return;
      const dx = e.clientX - startX;
      if (Math.abs(dx) > 40) show(index + (dx < 0 ? 1 : -1));
      startX = null;
    });

    // Les diaporamas ne tournent que lorsqu'ils sont à l'écran,
    // avec un léger décalage pour ne pas changer tous en même temps
    new IntersectionObserver(([it]) => {
      onScreen = it.isIntersecting;
      if (onScreen) setTimeout(schedule, (figIndex % 3) * 700); else clearTimeout(timer);
    }).observe(fig);

    imgs.forEach((img, k) => {
      const fail = () => {
        const s = img.parentElement;
        slides = slides.filter((x) => x !== s);
        s.remove();
        if (!slides.length) {
          const ph = document.createElement("div");
          ph.className = "placeholder";
          ph.style.whiteSpace = "pre-line";
          ph.textContent = "Photo à ajouter\n" + img.getAttribute("src");
          frame.replaceWith(ph);
          dots.remove();
        }
        refreshControls();
        show(Math.min(index, slides.length - 1));
      };
      if (img.complete && img.naturalWidth === 0) fail();
      else img.addEventListener("error", fail, { once: true });
      img.addEventListener("load", () => { if (slides[index] === img.parentElement) fit(); });
    });

    refreshControls();
    show(0);
  });

  /* ---------- Étiquette manuscrite + flèche sur une photo ----------
     data-note-from = où se pose l'étiquette, data-note-to = la personne visée,
     en % de la largeur / hauteur de la photo. La flèche part du bord de
     l'étiquette et décrit une légère courbe, comme tracée à la main.      */
  function addNote(img) {
    const slide = img.parentElement;
    if (!slide || slide.querySelector(".note")) return;
    const W = img.naturalWidth, H = img.naturalHeight;
    const pct = (s) => s.split(",").map(Number);
    const [fx, fy] = pct(img.dataset.noteFrom || "50,15");
    const [tx, ty] = pct(img.dataset.noteTo || "50,50");
    const down = ty > fy;

    const label = document.createElement("span");
    label.className = "note-label";
    label.textContent = img.dataset.note;
    label.style.left = fx + "%";
    label.style.top = fy + "%";
    label.style.transform = `translate(-50%, ${down ? "-100%" : "0"}) rotate(-3deg)`;

    // Flèche dans le repère de la photo (le cadre a exactement ses proportions)
    const x1 = fx / 100 * W, y1 = fy / 100 * H, x2 = tx / 100 * W, y2 = ty / 100 * H;
    const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy);
    const ux = dx / len, uy = dy / len;
    const sx = x1 + ux * len * 0.06, sy = y1 + uy * len * 0.06;        // petit jour après l'étiquette
    const cx = (sx + x2) / 2 - uy * len * 0.18, cy = (sy + y2) / 2 + ux * len * 0.18;
    // pointe : orientée selon la tangente en bout de courbe
    const tlen = Math.hypot(x2 - cx, y2 - cy), vx = (x2 - cx) / tlen, vy = (y2 - cy) / tlen;
    const head = Math.max(W, H) * 0.028;
    const hx1 = x2 - head * (vx * 0.87 - vy * 0.5), hy1 = y2 - head * (vy * 0.87 + vx * 0.5);
    const hx2 = x2 - head * (vx * 0.87 + vy * 0.5), hy2 = y2 - head * (vy * 0.87 - vx * 0.5);
    const d = `M ${sx} ${sy} Q ${cx} ${cy} ${x2} ${y2} M ${hx1} ${hy1} L ${x2} ${y2} L ${hx2} ${hy2}`;
    const sw = Math.max(W, H) * 0.0055;

    const svgNote = document.createElementNS(SVG_NS, "svg");
    svgNote.setAttribute("class", "note");
    svgNote.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svgNote.setAttribute("preserveAspectRatio", "none");
    svgNote.innerHTML =
      `<path d="${d}" stroke="rgba(0,0,0,.45)" stroke-width="${sw * 2.2}"/>` +
      `<path d="${d}" stroke="#fff" stroke-width="${sw}"/>`;
    slide.append(svgNote, label);
  }

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
      <path d="M8 60 L8 16 Q8 5 14 3 Q17 2 16 8 L16 60 Z"/>
      <path d="M22 60 L22 16 Q22 5 28 3 Q31 2 30 8 L30 60 Z"/>
      <path d="M8 34 L16 34 M8 41 L16 41 M22 34 L30 34 M22 41 L30 41"/>
      <path d="M44 14 L44 60 M56 14 L56 60"/>
      <path d="M41 3 L47 3 L47 14 L41 14 Z M53 3 L59 3 L59 14 L53 14 Z"/>
      <path d="M40 52 L48 52 M52 52 L60 52"/>`,
    piolet: `
      <path d="M22 58 L48 10"/>
      <path d="M34 6 L58 18 L56 22"/>
      <path d="M34 6 Q 20 10 10 24"/>
      <path d="M22 58 L20 62"/>`,
    crampon: `
      <path d="M12 4 L26 4 L27 20 L44 26 L50 30 L50 38 L8 38 L8 24 Z"/>
      <path d="M8 22 L28 20"/>
      <path d="M4 43 L52 43"/>
      <path d="M6 43 L9 57 L12 43 M18 43 L21 57 L24 43 M30 43 L33 57 L36 43 M40 43 L43 57 L46 43"/>
      <path d="M48 43 L63 49 L52 38"/>
      <path d="M10 43 L8 22 M46 43 L46 30"/>`,
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
      <path d="M32 12 L32 6 M2 52 L62 52"/>`,
    vinyle: `
      <path d="M6 32 A26 26 0 1 0 58 32 A26 26 0 1 0 6 32"/>
      <path d="M23 32 A9 9 0 1 0 41 32 A9 9 0 1 0 23 32"/>
      <path d="M13 25 A20 20 0 0 1 25 13"/>
      <path d="M39 51 A20 20 0 0 0 51 39"/>
      <path d="M32 31 L32 33"/>`,
    bateau: `
      <path d="M6 44 L58 44 L50 53 L14 53 Z"/>
      <path d="M32 44 L32 5"/>
      <path d="M30 9 L12 39 L30 39"/>
      <path d="M35 13 L50 39 L35 39"/>
      <path d="M2 60 L9 57 L16 60 L23 57 L30 60 L37 57 L44 60 L51 57 L58 60"/>`,
    renne: `
      <path d="M12 30 L42 30 L46 22 L55 25 L52 29 L46 35 L46 52"/>
      <path d="M46 22 L43 12 L37 8 M43 12 L46 5"/>
      <path d="M49 23 L53 13 L59 10 M53 13 L51 6"/>
      <path d="M12 30 L9 26 M14 30 L17 40 L42 40"/>
      <path d="M17 40 L15 52 M23 40 L25 52 M40 40 L38 52"/>
      <path d="M4 58 L60 58"/>`,
    engrenage: `
      <path d="M 50.8 34.5 L 58.1 38.8 L 55.3 45.7 L 47.1 43.6 L 43.6 47.1 L 45.7 55.3 L 38.8 58.1 L 34.5 50.8 L 29.5 50.8 L 25.2 58.1 L 18.3 55.3 L 20.4 47.1 L 16.9 43.6 L 8.7 45.7 L 5.9 38.8 L 13.2 34.5 L 13.2 29.5 L 5.9 25.2 L 8.7 18.3 L 16.9 20.4 L 20.4 16.9 L 18.3 8.7 L 25.2 5.9 L 29.5 13.2 L 34.5 13.2 L 38.8 5.9 L 45.7 8.7 L 43.6 16.9 L 47.1 20.4 L 55.3 18.3 L 58.1 25.2 L 50.8 29.5 Z"/>
      <path d="M24 32 A8 8 0 1 0 40 32 A8 8 0 1 0 24 32"/>`,
    velo: `
      <path d="M2 42 A12 12 0 1 0 26 42 A12 12 0 1 0 2 42"/>
      <path d="M38 42 A12 12 0 1 0 62 42 A12 12 0 1 0 38 42"/>
      <path d="M14 42 L31 42 L25 24 Z"/>
      <path d="M25 24 L45 24 L31 42 M45 24 L50 42"/>
      <path d="M45 24 L43 17 L49 16 M21 22 L29 22"/>`,
    avion: `
      <path d="M6 30.5 L50 29 Q60 32 50 35 L6 33.5 Z"/>
      <path d="M28 30 L19 8 L25 8 L40 29.5"/>
      <path d="M28 34 L19 56 L25 56 L40 34.5"/>
      <path d="M10 31 L4 21 L8 21 L16 30.5 M10 33 L4 43 L8 43 L16 33.5"/>`
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
    // Chapitre : à côté du titre de partie. Étape : juste après son titre.
    const head = host.querySelector(".chapter-head");
    const h4 = host.classList.contains("entry") && host.querySelector("h4");
    if (head) head.prepend(span);
    else if (h4) h4.append(span);
    else host.prepend(span);
    // Ceux des chapitres et des étapes se tracent avec le trait (voir render) ;
    // les autres (intro, avion entre deux étapes) dès qu'ils sont à l'écran.
    if (!head && !h4 && !host.classList.contains("signature")) doodleIO.observe(span);
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
