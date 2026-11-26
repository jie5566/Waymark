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
    const tip = document.getElementById("tip"); if (tip) tip.hidden = true;
    $$("[data-go]").forEach(b => b.setAttribute("aria-current", b.dataset.go === view || (view === "map" && b.closest(".side-tabs") && b.dataset.go === "log") ? "page" : "false"));
    if (view === "map") requestAnimationFrame(() => JV.renderMap($("#map")));
    if (view === "review") renderReview();
    if (view === "skills") renderSkills();
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
      if (r.entries?.length) {
        // Keep the job post as pasted (and its link) with the record, so it can be re-read and re-analysed later.
        const url = text.match(/https?:\/\/\S+/)?.[0] || "";
        drafts = drafts.concat(r.entries.map(d => d.type === "apply"
          ? { ...d, source: { url, text: text.slice(0, 12000) }, _meta: { model: r.model } } : d));
      }
      setQuick(r.quickReplies);
    } catch (err) {
      if (err.status === 401) {
        // Wrong or missing access code: ask for it, and put the message back so nothing is lost.
        st.chat.pop(); $("#msg").value = text; showToken(true);
      } else {
        st.chat.push({ role: "ai", text: JV.t().aiError });
        drafts.push({ type: "apply", title: text.slice(0, 60), region: st.regions[0]?.name });
      }
    }
    busy = false; S.save(); renderChat(); renderDrafts();
  }
  $("#composer").addEventListener("submit", e => { e.preventDefault(); const m = $("#msg"); send(m.value); m.value = ""; m.style.height = ""; });
  $("#msg").addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); $("#composer").requestSubmit(); } });
  $("#msg").addEventListener("input", e => { e.target.style.height = "auto"; e.target.style.height = e.target.scrollHeight + "px"; });

  // ---------- access code ----------
  function showToken(wrong) {
    const t = JV.t(), f = $("#token-form");
    $("#token-label").textContent = wrong && JV.getToken() ? t.tokenWrong : t.tokenLabel;
    $("#token-save").textContent = t.tokenSave;
    f.hidden = false; $("#token-input").focus();
  }
  $("#token-form").addEventListener("submit", e => {
    e.preventDefault(); const v = $("#token-input").value.trim(); if (!v) return;
    JV.setToken(v); $("#token-input").value = ""; $("#token-form").hidden = true;
    JV.sync && JV.sync({ force: true }).then(r => r.received && renderAll()).catch(() => {});
    if ($("#msg").value.trim()) $("#composer").requestSubmit();
  });

  // ---------- drafts (the card that fills while you talk) ----------
  function renderDrafts() {
    const t = JV.t(), wrap = $("#drafts");
    wrap.hidden = !drafts.length; if (!drafts.length) return;
    $("#drafts-title").textContent = t.drafts(drafts.length);
    $("#drafts-list").innerHTML = drafts.map((d, i) => `
      <div class="draft">
        ${(() => { const dup = d.type === "apply" && S.findDuplicate(d); return dup ? `<p class="dup">${esc(t.dupWarn(t.dateFmt(new Date(dup.date))))}</p>` : ""; })()}
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
    const kw = {}, posts = st.entries.filter(e => e.type === "apply" && (e.skills?.length || e.keywords?.length));
    posts.forEach(e => new Set(e.skills?.length ? e.skills : e.keywords).forEach(k => kw[k] = (kw[k] || 0) + 1));
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
      <p class="status-line">${esc(t.status(waiting, interviews))}</p>
      <section class="records"><h3>${esc(t.allRecords(st.entries.length))}</h3>
        ${st.entries.length ? [...st.entries].sort((x, y) => y.date.localeCompare(x.date)).map(e => `
          <button class="rec" data-open="${esc(e.id)}"><span class="chip ${esc(e.type)}">${esc(t.types[e.type])}</span>
            <span class="rec-title">${esc(e.title || [e.role, e.company].filter(Boolean).join(" · ") || "—")}</span>
            <span class="muted small">${esc(t.dateFmt(new Date(e.date)))}${e.status && e.status !== "waiting" ? " · " + esc(t.statusL[e.status]) : ""}</span></button>`).join("") : `<p class="empty">${esc(t.noRecords)}</p>`}
      </section>
      <p class="byline"><svg viewBox="0 0 789 873" aria-hidden="true"><path d="M330,0 L789,0 L518,873 L360,873 L636,107 L288,107 Z M38,763 L366,763 L330,873 L0,873 Z"/></svg>a Jvision product</p>`;
    bindOpen($("#view-review"));
  }

  function bindOpen(root) { root.querySelectorAll("[data-open]").forEach(b => b.addEventListener("click", () => JV.openEntry(b.dataset.open))); }

  // ---------- skills matrix ----------
  function renderSkills() {
    const t = JV.t(), D = JV.DIMS, box = $("#view-skills");
    const jobs = st.entries.filter(e => e.type === "apply" && e.focus).sort((a, b) => b.date.localeCompare(a.date));
    if (!jobs.length) { box.innerHTML = `<div><h2>${esc(t.skillsTitle)}</h2></div><p class="empty">${esc(t.skillsEmpty)}</p>`; return; }
    const avg = list => Object.fromEntries(D.map(d => [d, list.reduce((s, e) => s + (e.focus[d] || 0), 0) / list.length]));
    const all = avg(jobs), order = [...D].sort((a, b) => all[b] - all[a]);
    const bar = (d, v) => `<div class="fbar"><span>${esc(t.dims[d])}</span><span class="track"><i style="width:${Math.round(v / 3 * 100)}%"></i></span><span>${v.toFixed(1)}</span></div>`;
    const cut = Date.now() - 30 * 864e5;
    const recent = jobs.filter(e => new Date(e.date).getTime() >= cut), older = jobs.filter(e => new Date(e.date).getTime() < cut);
    let trend = `<p class="empty">${esc(t.trendNeed)}</p>`;
    if (recent.length >= 2 && older.length >= 2) {
      const a = avg(recent), b = avg(older);
      trend = order.map(d => { const dv = a[d] - b[d], cls = dv > 0.2 ? "delta-up" : dv < -0.2 ? "delta-down" : "muted";
        return `<div class="fbar"><span>${esc(t.dims[d])}</span><span class="track"><i style="width:${Math.round(a[d] / 3 * 100)}%"></i></span><span class="${cls}">${dv > 0 ? "+" : ""}${dv.toFixed(1)}</span></div>`; }).join("");
    }
    const shade = v => ["transparent", "#E3EBF4", "#A9C1DD", "#2F5D8C"][v || 0], ink = v => (v === 3 ? "#FFFFFF" : "#1E2329");
    const rows = jobs.map(e => `<tr data-open="${esc(e.id)}" tabindex="0"><td class="job" title="${esc(e.title)}">${esc(e.company || e.title)}<br><span class="muted small">${esc(e.roleType ? t.roles[e.roleType] : e.role || "")}</span></td>${D.map(d => `<td class="c" style="background:${shade(e.focus[d])};color:${ink(e.focus[d])}">${e.focus[d] || ""}</td>`).join("")}</tr>`).join("");
    const freq = {}; jobs.forEach(e => new Set(e.skills || []).forEach(k => freq[k] = (freq[k] || 0) + 1));
    const top = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 12);
    box.innerHTML = `
      <div><h2>${esc(t.skillsTitle)}</h2><span class="muted small">${esc(t.skillsLead(jobs.length))}</span></div>
      <section><h3>${esc(t.avgProfile)}</h3>${order.map(d => bar(d, all[d])).join("")}</section>
      <section><h3>${esc(t.trend)}</h3>${trend}</section>
      <section><h3>${esc(t.matrix)}</h3><div class="mx-wrap"><table class="mx"><thead><tr><th></th>${D.map(d => `<th title="${esc(t.dims[d])}">${esc(t.dimShort[d])}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table></div></section>
      ${top.length ? `<section><h3>${esc(t.topSkills)}</h3><div class="chips">${top.map(([k, n]) => `<span>${esc(k)} · ${n}</span>`).join("")}</div></section>` : ""}
      <div><button class="btn" id="csv">${esc(t.exportCsv)}</button></div>`;
    $("#csv").addEventListener("click", exportCsv);
    bindOpen(box);
    box.querySelectorAll("tr[data-open]").forEach(r => r.addEventListener("keydown", ev => { if (ev.key === "Enter") JV.openEntry(r.dataset.open); }));
  }
  function exportCsv() {
    const D = JV.DIMS, q = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const head = ["id", "date", "logged", "company", "role", "title", "roleType", "seniority", "region", ...D, "skills", "status", "edited_by_hand", "ai_model", "source_url"];
    const lines = st.entries.filter(e => e.type === "apply").map(e => [e.id, e.date.slice(0, 10), (e.createdAt || "").slice(0, 10), e.company, e.role, e.title, e.roleType, e.seniority,
      S.regionName(e.regionId), ...D.map(d => e.focus?.[d] ?? ""), (e.skills || []).join("; "), e.status, (e.edited || []).join(" "), e.ai?.model || "", e.source?.url || ""].map(q).join(","));
    const blob = new Blob(["\ufeff" + [head.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `waymark-jobs-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function renderAll() { renderMapPane(); renderChat(); renderDrafts(); const v = document.body.dataset.view; if (v === "review") renderReview(); if (v === "skills") renderSkills(); }
  function esc(s) { return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]); }

  JV.refresh = () => renderAll();
  $("#open-settings").addEventListener("click", () => JV.openSettings());
  S.migrate();
  applyLang();
  window.addEventListener("hashchange", () => { const h = location.hash.slice(1); if (["map", "log", "review", "skills"].includes(h) && h !== document.body.dataset.view) go(h); });
  go(["map", "log", "review", "skills"].includes(location.hash.slice(1)) ? location.hash.slice(1) : "map");
})();
