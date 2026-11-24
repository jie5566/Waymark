// Local-first storage: everything stays in this browser (localStorage).
// Later this can sync to a database without changing the rest of the app.
window.JV = window.JV || {};
(function () {
  const KEY = "waymark.v1";
  const blank = () => ({ lang: "zh", quiet: false, regions: [], entries: [], chat: [], startedAt: new Date().toISOString() });
  let state;
  try { state = Object.assign(blank(), JSON.parse(localStorage.getItem(KEY) || "{}")); } catch { state = blank(); }

  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* storage may be off */ } };
  const uid = () => Math.random().toString(36).slice(2, 10);
  const norm = s => (s || "").trim().toLowerCase();

  JV.store = {
    state, save, uid,
    // Find a region by name, or create it (so the map grows a new area).
    region(name) {
      if (!name) name = state.regions[0]?.name || "—";
      let r = state.regions.find(x => norm(x.name) === norm(name));
      if (!r) { r = { id: uid(), name, slot: state.regions.length, createdAt: new Date().toISOString() }; state.regions.push(r); }
      return r;
    },
    addEntries(drafts) {
      for (const d of drafts) {
        const r = this.region(d.region);
        state.entries.push({
          id: uid(), date: new Date().toISOString(), type: d.type || "apply", title: d.title || "",
          company: d.company || "", role: d.role || "", regionId: r.id, insight: d.insight || "",
          next: d.nextText ? { date: d.nextDate || "", text: d.nextText } : null,
          keywords: d.keywords || [], status: d.type === "apply" ? "waiting" : null,
        });
      }
      save();
    },
    stats(days = 7) {
      const since = Date.now() - days * 864e5;
      const recent = state.entries.filter(e => new Date(e.date).getTime() >= since);
      const by = t => recent.filter(e => e.type === t).length;
      return { apply: by("apply"), connect: by("connect"), make: by("make"), learn: by("learn"), rest: by("rest"),
        total: recent.length, allTime: state.entries.length, regions: state.regions.map(r => r.name) };
    },
    weekNumber() { return Math.max(1, Math.floor((Date.now() - new Date(state.startedAt).getTime()) / (7 * 864e5)) + 1); },
  };
})();
