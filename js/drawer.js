// Side drawer: edit one record (fields, scores, skills, status), re-analyze it, delete it;
// and the settings panel (access code, cloud sync, backup).
window.JV = window.JV || {};
(function () {
  const $ = s => document.querySelector(s);
  const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const dlg = () => $("#drawer");
  const opt = (val, label, cur) => `<option value="${esc(val)}"${val === cur ? " selected" : ""}>${esc(label)}</option>`;
  let afterClose = null;

  function open(html, onClose) {
    const d = dlg(); d.innerHTML = html; afterClose = onClose || null;
    if (!d.open) d.showModal();
    d.querySelector("[data-close]")?.addEventListener("click", close);
  }
  function close() { const d = dlg(); if (d.open) d.close(); }
  // The <dialog> is in index.html above the scripts, so it exists by now.
  const d0 = dlg();
  d0.addEventListener("close", () => { const f = afterClose; afterClose = null; if (f) f(); });
  d0.addEventListener("click", ev => { if (ev.target === d0) close(); }); // click on the backdrop

  // ---------- record editor ----------
  JV.openEntry = function (id) {
    const st = JV.store.state, t = JV.t(), e = st.entries.find(x => x.id === id); if (!e) return;
    const isApply = e.type === "apply", f = e.focus || {};
    const dateVal = (e.date || "").slice(0, 10);
    const ai = e.ai ? t.aiBy(e.ai.model || "Gemini", t.dateFmt(new Date(e.ai.at || e.date)), e.ai.version) : t.aiNone;
    const hist = (e.statusHistory || []).map(h => `${t.statusL[h.status] || h.status} · ${t.dateFmt(new Date(h.at))}`).join(" → ");
    open(`
      <form class="drawer-body" id="entry-form">
        <header class="drawer-head"><h2>${esc(t.editTitle)}</h2><button type="button" class="icon-btn" data-close aria-label="${esc(t.close)}">×</button></header>
        <div class="grid2">
          <label>${esc(t.fType)}<select name="type">${Object.entries(t.types).map(([k, v]) => opt(k, v, e.type)).join("")}</select></label>
          <label>${esc(t.fDate)}<input type="date" name="date" value="${esc(dateVal)}"></label>
        </div>
        <label>${esc(t.fTitle)}<input name="title" value="${esc(e.title)}"></label>
        <div class="grid2">
          <label>${esc(t.fCompany)}<input name="company" value="${esc(e.company)}"></label>
          <label>${esc(t.fRole)}<input name="role" value="${esc(e.role)}"></label>
        </div>
        <label>${esc(t.fArea)}<input name="region" list="regions" value="${esc(JV.store.regionName(e.regionId))}">
          <datalist id="regions">${st.regions.map(r => `<option value="${esc(r.name)}">`).join("")}</datalist></label>
        ${isApply ? `
        <div class="grid2">
          <label>${esc(t.fStatus)}<select name="status">${JV.STATUSES.map(s => opt(s, t.statusL[s], e.status)).join("")}</select></label>
          <label>${esc(t.fSeniority)}<select name="seniority">${opt("", "—", e.seniority)}${Object.entries(t.seniorityL).filter(([k]) => k !== "unknown").map(([k, v]) => opt(k, v, e.seniority)).join("")}</select></label>
        </div>
        ${hist ? `<p class="muted small">${esc(hist)}</p>` : ""}
        <label>${esc(t.fRoleType)}<select name="roleType">${opt("", "—", e.roleType)}${Object.entries(t.roles).map(([k, v]) => opt(k, v, e.roleType)).join("")}</select></label>
        <fieldset class="scores"><legend>${esc(t.focusLabel)} (0–3)</legend>
          ${JV.DIMS.map(d => `<label class="score"><span>${esc(t.dims[d])}</span><input type="range" min="0" max="3" step="1" name="f_${d}" value="${f[d] || 0}" aria-label="${esc(t.dims[d])}"><output>${f[d] || 0}</output></label>`).join("")}
        </fieldset>
        <label>${esc(t.skillsLabel)} <span class="muted small">${esc(t.skillsHint)}</span><input name="skills" value="${esc((e.skills || []).join(", "))}"></label>
        <p class="muted small">${esc(ai)}${e.edited?.length ? " · " + esc(t.editedNote) : ""}</p>` : ""}
        <label>${esc(t.fInsight)}<textarea name="insight" rows="2">${esc(e.insight)}</textarea></label>
        ${e.source?.url ? `<p class="small"><a href="${esc(e.source.url)}" target="_blank" rel="noopener">${esc(t.sourceLink)}</a></p>` : ""}
        ${e.source?.text ? `<details><summary>${esc(t.sourceText)}</summary><div class="source-text">${esc(e.source.text)}</div></details>` : ""}
        <p class="form-msg" id="entry-msg" role="status"></p>
        <footer class="drawer-foot">
          <button type="submit" class="btn primary">${esc(t.save)}</button>
          ${isApply && e.source?.text ? `<button type="button" class="btn" id="reanalyze">${esc(t.reanalyze)}</button>` : ""}
          <span class="spacer"></span>
          <button type="button" class="btn danger" id="del">${esc(t.del)}</button>
        </footer>
      </form>`, () => JV.refresh && JV.refresh());

    const form = $("#entry-form"), msg = $("#entry-msg");
    form.querySelectorAll('input[type="range"]').forEach(r => r.addEventListener("input", () => { r.nextElementSibling.textContent = r.value; }));
    form.addEventListener("submit", ev => {
      ev.preventDefault();
      const v = Object.fromEntries(new FormData(form));
      const patch = { type: v.type, title: v.title.trim(), company: v.company.trim(), role: v.role.trim(), insight: v.insight.trim() };
      if (v.date) patch.date = new Date(v.date + "T12:00:00").toISOString();
      if (v.region?.trim()) patch.region = v.region.trim();
      if (isApply) {
        patch.status = v.status; patch.roleType = v.roleType; patch.seniority = v.seniority;
        patch.focus = Object.fromEntries(JV.DIMS.map(d => [d, Number(v["f_" + d]) || 0]));
        patch.skills = v.skills.split(/[,，;；]/).map(s => s.trim()).filter(Boolean);
        // Only count the scores and skills as hand edits if they actually differ from the AI's.
        if (e.ai && JSON.stringify(patch.focus) === JSON.stringify(e.ai.focus)) delete patch.focus;
        if (e.ai && JSON.stringify(patch.skills.map(JV.canonSkill)) === JSON.stringify(e.skills)) delete patch.skills;
      }
      JV.store.updateEntry(e.id, patch); close();
    });
    $("#reanalyze")?.addEventListener("click", async () => {
      msg.textContent = t.analyzing;
      try {
        const r = await JV.analyze(e.source.text);
        const d = (r.entries || []).find(x => x.type === "apply") || r.entries?.[0];
        if (!d) throw new Error("no entry");
        JV.store.reanalyzed(e.id, d, { model: r.model });
        msg.textContent = t.analyzed; setTimeout(() => JV.openEntry(e.id), 400);
      } catch (err) { msg.textContent = err.status === 401 ? t.tokenWrong : t.aiError; }
    });
    const del = $("#del");
    del.addEventListener("click", () => {
      if (del.dataset.confirm) { JV.store.removeEntry(e.id); close(); return; }
      del.dataset.confirm = "1"; del.textContent = t.delConfirm;
    });
  };

  // ---------- settings: access code, sync, backup ----------
  JV.openSettings = function () {
    const t = JV.t(), st = JV.store.state, has = !!JV.getToken();
    const last = st.lastSyncAt ? t.syncedAt(new Date(st.lastSyncAt).toLocaleString()) : t.neverSynced;
    open(`
      <div class="drawer-body">
        <header class="drawer-head"><h2>${esc(t.settings)}</h2><button type="button" class="icon-btn" data-close aria-label="${esc(t.close)}">×</button></header>
        <section class="set-sec">
          <h3>${esc(t.syncTitle)}</h3>
          <p class="muted small">${esc(t.syncLead)}</p>
          <form class="token-row" id="set-token">
            <label class="sr-only" for="set-token-in">${esc(t.tokenLabel)}</label>
            <input id="set-token-in" type="password" autocomplete="current-password" placeholder="${esc(has ? t.tokenIsSet : t.tokenPlaceholder)}">
            <button class="btn" type="submit">${esc(t.tokenSave)}</button>
          </form>
          <div class="row"><button class="btn primary" id="sync-now"${has ? "" : " disabled"}>${esc(t.syncNow)}</button><span class="muted small" id="sync-msg">${esc(has ? last : t.syncNeedsToken)}</span></div>
        </section>
        <section class="set-sec" id="set-jobs"></section>
        <section class="set-sec">
          <h3>${esc(t.backupTitle)}</h3>
          <p class="muted small">${esc(t.backupLead(st.entries.length))}</p>
          <div class="row">
            <button class="btn" id="bk-export">${esc(t.backupExport)}</button>
            <label class="btn file-btn">${esc(t.backupImport)}<input type="file" id="bk-import" accept="application/json,.json" hidden></label>
          </div>
          <p class="muted small" id="bk-msg" role="status"></p>
        </section>
      </div>`, () => JV.refresh && JV.refresh());

    if (JV.renderJobSettings) JV.renderJobSettings($("#set-jobs"));
    $("#set-token").addEventListener("submit", ev => {
      ev.preventDefault(); const v = $("#set-token-in").value.trim(); if (!v) return;
      JV.setToken(v); JV.loadPicks && JV.loadPicks(true); JV.openSettings(); JV.sync && JV.sync({ force: true }).then(() => JV.openSettings()).catch(() => JV.openSettings());
    });
    $("#sync-now").addEventListener("click", async () => {
      const m = $("#sync-msg"); m.textContent = t.syncing;
      try { const r = await JV.sync({ force: true }); m.textContent = t.syncDone(r.sent, r.received); }
      catch (err) { m.textContent = err.status === 401 ? t.tokenWrong : err.status === 403 ? t.syncNotEnabled : t.syncFailed; }
    });
    $("#bk-export").addEventListener("click", () => {
      const blob = new Blob([JSON.stringify(JV.store.exportJSON(), null, 2)], { type: "application/json" });
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
      a.download = `waymark-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    });
    $("#bk-import").addEventListener("change", async ev => {
      const file = ev.target.files[0]; if (!file) return; const m = $("#bk-msg");
      try { const n = JV.store.importJSON(JSON.parse(await file.text())); m.textContent = t.backupImported(n); JV.sync && JV.sync().catch(() => {}); }
      catch { m.textContent = t.backupBad; }
    });
  };
})();
