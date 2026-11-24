// App shell: language, navigation, the log conversation, drafts, and the weekly review.
(function () {
  const S = JV.store, st = S.state, $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  let drafts = [], busy = false;

  // ---------- language & static text ----------
  function applyLang() {
    const t = JV.t();
    document.documentElement.lang = { zh: "zh-CN", en: "en", sv: "sv" }[st.lang];
    $$("[data-i18n]").forEach(n => { const v = t[n.dataset.i18n]; if (typeof v === "string") n.textContent = v; });
    $$("[data-lang]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.lang === st.lang)));
    $("#msg").placeholder = t.placeholder;
    const badge = $("#mode-badge"); badge.hidden = JV.aiEnabled; badge.textContent = t.demo;
    $("#quiet").checked = st.quiet;
    renderAll();
  }
  $$("[data-lang]").forEach(b => b.addEventListener("click", () => { st.lang = b.dataset.lang; S.save(); applyLang(); }));
  $("#quiet").addEventListener("change", e => { st.quiet = e.target.checked; S.save(); });

  // ---------- navigation ----------
  function go(view) {
    document.body.dataset.view = view;
    $$("[data-go]").forEach(b => b.setAttribute("aria-current", b.dataset.go === view || (view === "map" && b.closest(".side-tabs") && b.dataset.go === "log") ? "page" : "false"));
    if (view === "map") requestAnimationFrame(() => JV.renderMap($("#map")));
    if (view === "review") renderReview();
    if (location.hash !== "#" + view) history.replaceState(null, "", "#" + view);
  }
  $$("[data-go]").forEach(b => b.addEventListener("click", () => go(b.dataset.go)));
  window.addEventListener("resize", () => JV.renderMap($("#map")));

  // ---------- map pane ----------
  function renderMapPane() {
    const t = JV.t(), all = st.entries, n = k => all.filter(e => e.type === k).length;
    $("#map-sub").textContent = t.mapSub(S.weekNumber(), st.regions.length);
    const items = [["apply", "legApply", '<svg width="10" height="10" aria-hidden="true"><circle cx="5" cy="5" r="3.5" fill="#2F5D8C"/></svg>'],
      ["connect", "legConnect", '<svg width="12" height="12" aria-hidden="true"><circle cx="6" cy="6" r="4" fill="none" stroke="#B4561A" stroke-width="1.6"/></svg>'],
      ["make", "legMake", '<svg width="10" height="10" aria-hidden="true"><rect x="1" y="1" width="8" height="8" rx="1" fill="#6B4FA8"/></svg>'],
      ["learn", "legLearn", '<svg width="12" height="12" aria-hidden="true"><path d="M6 1 L11 10 L1 10 Z" fill="none" stroke="#2C7A6B" stroke-width="1.5"/></svg>']];
    $("#legend").innerHTML = items.map(([k, l, ic]) => `<span>${ic}${esc(t[l])} <b>${n(k)}</b></span>`).join("");
    JV.renderMap($("#map"));
  }

  // ---------- conversation ----------
  function renderChat() {
    const box = $("#chat"), t = JV.t();
    const msgs = st.chat.length ? st.chat : [{ role: "ai", text: t.hello }];
    box.innerHTML = msgs.map(m => `<div class="msg ${m.role === "ai" ? "ai" : "me"}">${esc(m.text)}</div>`).join("") + (busy ? '<div class="msg ai typing">…</div>' : "");
    box.scrollTop = box.scrollHeight;
  }
  function setQuick(list) {
    $("#quick").innerHTML = (list || []).map(q => `<button class="btn" type="button">${esc(q)}</button>`).join("");
    $$("#quick button").forEach(b => b.addEventListener("click", () => send(b.textContent)));
  }
  async function send(text) {
    text = text.trim(); if (!text || busy) return;
    st.chat.push({ role: "me", text }); busy = true; setQuick([]); renderChat(); S.save();
    try {
      const r = await JV.ask(text);
      if (r.reply) st.chat.push({ role: "ai", text: r.reply });
      if (r.entries?.length) { drafts = drafts.concat(r.entries); }
      setQuick(r.quickReplies);
    } catch (err) {
      st.chat.push({ role: "ai", text: JV.t().aiError });
      drafts.push({ type: "apply", title: text.slice(0, 60), region: st.regions[0]?.name });
    }
    busy = false; S.save(); renderChat(); renderDrafts();
  }
  $("#composer").addEventListener("submit", e => { e.preventDefault(); const m = $("#msg"); send(m.value); m.value = ""; m.style.height = ""; });
  $("#msg").addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); $("#composer").requestSubmit(); } });
  $("#msg").addEventListener("input", e => { e.target.style.height = "auto"; e.target.style.height = e.target.scrollHeight + "px"; });

  // ---------- drafts (the card that fills while you talk) ----------
  function renderDrafts() {
    const t = JV.t(), wrap = $("#drafts");
    wrap.hidden = !drafts.length; if (!drafts.length) return;
    $("#drafts-title").textContent = t.drafts(drafts.length);
    $("#drafts-list").innerHTML = drafts.map((d, i) => `
      <div class="draft">
        <div class="draft-row"><span class="chip ${esc(d.type)}">${esc(t.types[d.type] || d.type)}</span>
          <span class="draft-title" contenteditable="true" data-i="${i}" data-k="title">${esc(d.title || [d.role, d.company].filter(Boolean).join(" · "))}</span></div>
        ${d.region ? `<div class="field"><span>${esc(t.fArea)}</span><span contenteditable="true" data-i="${i}" data-k="region">${esc(d.region)}</span></div>` : ""}
        ${d.insight ? `<div class="field"><span>${esc(t.fInsight)}</span><span contenteditable="true" data-i="${i}" data-k="insight">${esc(d.insight)}</span></div>` : ""}
        ${d.nextText ? `<div class="field"><span>${esc(t.fNext)}</span><span>${esc([d.nextDate, d.nextText].filter(Boolean).join(" · "))}</span></div>` : ""}
      </div>`).join("");
    $$("#drafts-list [contenteditable]").forEach(n => n.addEventListener("input", () => { drafts[n.dataset.i][n.dataset.k] = n.textContent; }));
  }
  $("#drafts-save").addEventListener("click", () => {
    const n = drafts.length; S.addEntries(drafts); drafts = [];
    st.chat.push({ role: "ai", text: JV.t().saved(n) }); S.save();
    renderDrafts(); renderChat(); renderMapPane();
  });
  $("#drafts-discard").addEventListener("click", () => { drafts = []; renderDrafts(); });

  // ---------- weekly review ----------
  function renderReview() {
    const t = JV.t(), since = Date.now() - 7 * 864e5;
    const week = st.entries.filter(e => new Date(e.date).getTime() >= since);
    const newRegion = st.regions.find(r => new Date(r.createdAt).getTime() >= since);
    const c = k => week.filter(e => e.type === k).length;
    const notes = week.filter(e => e.insight).slice(-4).reverse();
    const kw = {}, posts = st.entries.filter(e => e.type === "apply" && e.keywords?.length);
    posts.forEach(e => new Set(e.keywords).forEach(k => kw[k] = (kw[k] || 0) + 1));
    const top = Object.entries(kw).sort((a, b) => b[1] - a[1]).slice(0, 4);
    const waiting = st.entries.filter(e => e.status === "waiting").length, interviews = st.entries.filter(e => e.status === "interview").length;
    const a = new Date(since + 864e5), b = new Date();
    $("#view-review").innerHTML = `
      <div><span class="muted small">${esc(t.weekLabel(S.weekNumber(), t.dateFmt(a), t.dateFmt(b)))}</span>
        <h2>${esc(newRegion ? t.reviewH1New(newRegion.name) : t.reviewH1(week.length))}</h2></div>
      <div class="stats">
        <div class="stat"><b>${c("apply")}</b><span>${esc(t.sApply)}</span></div>
        <div class="stat"><b>${c("connect")}</b><span>${esc(t.sConnect)}</span></div>
        <div class="stat"><b>${c("make")}</b><span>${esc(t.sMake)}</span></div>
        <div class="stat"><b>${notes.length}</b><span>${esc(t.sInsight)}</span></div>
      </div>
      <div style="display:flex;flex-direction:column;gap:10px"><h3>${esc(t.notes)}</h3>
        ${notes.length ? notes.map(e => `<div class="quote"><span>${esc(e.insight)}</span><span class="muted small">${esc(t.types[e.type])} · ${esc(t.dateFmt(new Date(e.date)))}</span></div>`).join("") : `<p class="empty">${esc(t.noNotes)}</p>`}
      </div>
      ${top.length ? `<div class="kw"><h3>${esc(t.jd)}</h3>${top.map(([k, n]) => `
        <div class="kw-row"><span>${esc(k)}</span><div class="bar" role="img" aria-label="${esc(t.jdLine(k, n, posts.length))}"><i style="width:${Math.round(100 * n / posts.length)}%"></i></div><span class="muted">${n}</span></div>`).join("")}</div>` : ""}
      <p class="status-line">${esc(t.status(waiting, interviews))}</p>`;
  }

  function renderAll() { renderMapPane(); renderChat(); renderDrafts(); if (document.body.dataset.view === "review") renderReview(); }
  function esc(s) { return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]); }

  applyLang();
  go(["map", "log", "review"].includes(location.hash.slice(1)) ? location.hash.slice(1) : "map");
})();
