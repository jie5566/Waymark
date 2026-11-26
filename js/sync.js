// Cloud sync with the Waymark Worker (Cloudflare D1), protected by the access code.
// Each record carries updatedAt; the newer copy wins, on this device and in the cloud.
// Deletions travel as tombstones so they reach your other devices too.
window.JV = window.JV || {};
(function () {
  const cfg = window.JV_CONFIG || {};
  const S = JV.store, st = S.state;
  let running = null, timer = null;

  function collect() {
    const items = [];
    for (const [id, kind] of Object.entries(st.dirty)) {
      const obj = (kind === "region" ? st.regions : st.entries).find(x => x.id === id);
      if (obj) { items.push({ kind, id, updatedAt: obj.updatedAt || Date.now(), data: obj }); continue; }
      const tomb = st.tombstones.find(x => x.id === id);
      if (tomb) items.push({ kind, id, updatedAt: tomb.updatedAt, deleted: true });
    }
    return items;
  }

  JV.syncEnabled = () => !!(cfg.AI_URL && JV.getToken());

  JV.sync = function ({ force = false } = {}) {
    if (!JV.syncEnabled()) return Promise.reject(Object.assign(new Error("no token"), { status: 0 }));
    if (running) return running;
    running = (async () => {
      const items = collect();
      if (!force && !items.length && Date.now() - (st.lastSyncAt || 0) < 60000) return { sent: 0, received: 0 };
      const res = await fetch(cfg.AI_URL.replace(/\/$/, "") + "/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-waymark-token": JV.getToken() },
        body: JSON.stringify({ since: st.lastSync || 0, items }),
      });
      if (!res.ok) throw Object.assign(new Error("sync " + res.status), { status: res.status });
      const data = await res.json();
      // Clear what we sent, unless it changed again while we were waiting.
      for (const it of items) {
        const obj = (it.kind === "region" ? st.regions : st.entries).find(x => x.id === it.id);
        if (!obj || (obj.updatedAt || 0) <= it.updatedAt) delete st.dirty[it.id];
      }
      const received = S.merge(data.items || []);
      st.lastSync = data.cursor || st.lastSync; st.lastSyncAt = Date.now(); S.save();
      return { sent: items.length, received };
    })();
    running.finally(() => { running = null; }).catch(() => {});
    return running;
  };

  // Quietly keep things in sync: shortly after a change, when the app comes back, and every few minutes.
  function soon() { clearTimeout(timer); timer = setTimeout(() => JV.syncEnabled() && JV.sync().then(r => r.received && JV.refresh && JV.refresh()).catch(() => {}), 3000); }
  S.onChange(() => { if (Object.keys(st.dirty).length) soon(); });
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") soon(); });
  setInterval(() => { if (document.visibilityState === "visible") soon(); }, 180000);
  if (JV.syncEnabled()) soon();
})();
