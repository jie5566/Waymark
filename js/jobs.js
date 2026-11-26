// Job discovery: a small card at the top of the log with today's few picks from Platsbanken.
// The Worker finds and scores the ads once a day (worker/jobs.js); this file only shows them.
// "I applied" sends the ad into the normal conversation, so it becomes a journal entry like any other.
window.JV = window.JV || {};
(function () {
  const cfg = window.JV_CONFIG || {};
  const $ = s => document.querySelector(s);
  const OPEN_KEY = "waymark.picksOpen";
  let data = null, loadedAt = 0, loading = null;

  const enabled = () => !!(cfg.AI_URL && JV.getToken());
  const isOpen = () => { try { return localStorage.getItem(OPEN_KEY) === "1"; } catch { return false; } };
  const setOpen = v => { try { localStorage.setItem(OPEN_KEY, v ? "1" : "0"); } catch { /* storage off */ } };
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  JV.jobsApi = async function (body) {
    const res = await fetch(cfg.AI_URL.replace(/\/$/, "") + "/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-waymark-token": JV.getToken() },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw Object.assign(new Error("jobs " + res.status), { status: res.status });
    return res.json();
  };

  async function load(force) {
    if (!enabled()) { data = null; render(); return; }
    if (!force && data && Date.now() - loadedAt < 10 * 60000) { render(); return; }
    if (loading) return loading;
    loading = JV.jobsApi({ action: "list" })
      .then(d => { data = d; loadedAt = Date.now(); })
      .catch(() => { data = null; }) // jobs not switched on yet, or offline: just stay hidden
      .finally(() => { loading = null; render(); });
    return loading;
  }

  function render() {
    const box = $("#picks"); if (!box) return;
    const t = JV.t(), J = t.jobs, lang = JV.store.state.lang;
    const picks = data?.picks || [];
    box.hidden = !picks.length;
    if (!picks.length) { box.innerHTML = ""; return; }
    const open = isOpen();
    box.innerHTML = `
      <button class="picks-head" type="button" aria-expanded="${open}" aria-controls="picks-list">
        <span>${esc(J.title)} <b>${picks.length}</b></span>
        <span class="muted small">${esc(open ? J.hide : J.show)}</span>
      </button>
      <div id="picks-list" class="picks-list"${open ? "" : " hidden"}>
        ${picks.map(p => {
          const pr = p.profile || {};
          const meta = [p.company, p.location, p.deadline ? J.deadline(t.dateFmt(new Date(p.deadline))) : ""].filter(Boolean).join(" · ");
          return `<article class="pick" data-id="${esc(p.id)}">
            <div class="pick-top"><h3>${esc(p.title)}</h3><span class="fit ${p.score >= 0.8 ? "hi" : ""}">${esc(p.score >= 0.8 ? J.fitHigh : J.fitMid)}</span></div>
            <p class="muted small">${esc(meta)}</p>
            ${pr.summary?.[lang] ? `<p class="pick-sum">${esc(pr.summary[lang])}</p>` : ""}
            <div class="pick-actions">
              <a class="btn" href="${esc(p.url)}" target="_blank" rel="noopener">${esc(J.open)}</a>
              <button class="btn primary" type="button" data-act="applied">${esc(J.applied)}</button>
              <button class="btn" type="button" data-act="dismissed">${esc(J.skip)}</button>
            </div>
          </article>`;
        }).join("")}
        ${data.more ? `<p class="muted small">${esc(J.more(data.more))}</p>` : ""}
      </div>`;
    box.querySelector(".picks-head").addEventListener("click", () => { setOpen(!open); render(); });
    box.querySelectorAll("[data-act]").forEach(b => b.addEventListener("click", () => act(b.closest(".pick").dataset.id, b.dataset.act, b)));
  }

  async function act(id, status, btn) {
    const J = JV.t().jobs, pick = data.picks.find(p => p.id === id); if (!pick) return;
    btn.disabled = true;
    try {
      const r = await JV.jobsApi({ action: "set", id, status });
      data.picks = data.picks.filter(p => p.id !== id);
      render();
      if (status === "applied") {
        const job = r.job || pick, pr = job.profile || {};
        // The AI sees the whole ad (so it can ask its usual follow-up); the chat shows one short line.
        const message = `${J.aiApplied(job.title, job.company, job.location)}\n\n${job.text || ""}`;
        const fallback = { type: "apply", title: job.title, company: job.company, role: job.title,
          roleType: pr.roleType, seniority: pr.seniority, focus: pr.focus, skills: pr.skills,
          source: { url: job.url, text: job.text || "" } };
        if (document.body.dataset.view !== "log" && window.innerWidth < 900) location.hash = "#log";
        const ok = await JV.sendLog(message, { display: J.chatApplied(job.title, job.company), url: job.url, sourceText: job.text || "", fallback });
        // The conversation was busy: put the pick back rather than lose it.
        if (ok === false) { await JV.jobsApi({ action: "set", id, status: "new" }).catch(() => {}); load(true); }
      }
    } catch { btn.disabled = false; }
  }

  // Settings → Job discovery. Called from the settings drawer.
  JV.renderJobSettings = async function (root) {
    const t = JV.t(), J = t.jobs;
    if (!enabled()) { root.innerHTML = `<h3>${esc(J.setTitle)}</h3><p class="muted small">${esc(J.setNeedsToken)}</p>`; return; }
    root.innerHTML = `<h3>${esc(J.setTitle)}</h3><p class="muted small">${esc(J.setLead)}</p><p class="muted small">${esc(t.syncing)}</p>`;
    let s;
    try { s = (await JV.jobsApi({ action: "settings" })).settings; }
    catch (err) { root.innerHTML = `<h3>${esc(J.setTitle)}</h3><p class="muted small">${esc(err.status === 403 ? t.syncNotEnabled : J.setFailed)}</p>`; return; }
    root.innerHTML = `
      <h3>${esc(J.setTitle)}</h3>
      <p class="muted small">${esc(J.setLead)}</p>
      <form class="job-set" id="job-set">
        <label>${esc(J.setQueries)}<textarea id="js-q" rows="2">${esc(s.queries.join(", "))}</textarea></label>
        <div class="row">
          <label>${esc(J.setRadius)}<input id="js-r" type="number" min="5" max="300" value="${esc(s.radiusKm)}"></label>
          <label>${esc(J.setPerDay)}<input id="js-n" type="number" min="1" max="10" value="${esc(s.perDay)}"></label>
        </div>
        <div class="row"><button class="btn" type="submit">${esc(t.save)}</button><button class="btn primary" type="button" id="js-run">${esc(J.setRun)}</button></div>
        <p class="muted small" id="js-msg" role="status">${esc(data?.lastRun ? J.lastRun(new Date(data.lastRun).toLocaleString()) : "")}</p>
      </form>`;
    const msg = root.querySelector("#js-msg");
    root.querySelector("#job-set").addEventListener("submit", async ev => {
      ev.preventDefault();
      try {
        await JV.jobsApi({ action: "settings", settings: {
          queries: root.querySelector("#js-q").value.split(/[,，\n]/).map(x => x.trim()).filter(Boolean),
          radiusKm: root.querySelector("#js-r").value, perDay: root.querySelector("#js-n").value } });
        msg.textContent = J.setSaved; load(true);
      } catch { msg.textContent = J.setFailed; }
    });
    root.querySelector("#js-run").addEventListener("click", async ev => {
      ev.target.disabled = true; msg.textContent = J.running;
      try { const r = await JV.jobsApi({ action: "refresh" }); msg.textContent = J.ran(r.unique || 0, r.analysed || 0); await load(true); }
      catch { msg.textContent = J.setFailed; }
      ev.target.disabled = false;
    });
  };

  JV.renderPicks = render;
  JV.loadPicks = load;
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") load(); });
  load();
})();
