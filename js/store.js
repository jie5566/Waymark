// Waymark data store (schema v2).
// Local-first: everything lives in this browser (localStorage) and, when an access code is set,
// syncs to the cloud (see sync.js). Every change goes through this file so it can be tracked.
//
// Entry (v2):
//   id, v, createdAt (when logged), updatedAt (ms, for sync), date (when it happened, editable)
//   type: apply | connect | make | learn | rest
//   title, company, role, regionId, insight, next {date, text}
//   status (apply only): waiting | no_reply | rejected | interview | offer, statusHistory [{status, at}]
//   roleType, seniority, focus {8 dims 0–3}, skills [canonical names]   <- the values in use
//   source {url, text}                                                  <- the job post as pasted
//   ai {model, version, at, roleType, seniority, focus, skills, skillsRaw}  <- what the AI said
//   edited [field names the user changed by hand; re-analysis never overwrites these]
window.JV = window.JV || {};
(function () {
  const KEY = "waymark.v1";
  const SCHEMA = 2;
  const blank = () => ({ schema: SCHEMA, lang: "zh", quiet: false, regions: [], entries: [], chat: [],
    startedAt: new Date().toISOString(), tombstones: [], dirty: {}, lastSync: 0 });
  let state;
  try { state = Object.assign(blank(), JSON.parse(localStorage.getItem(KEY) || "{}")); } catch { state = blank(); }

  const listeners = [];
  const save = () => {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* storage may be off */ }
    listeners.forEach(f => { try { f(); } catch { /* ignore */ } });
  };
  const uid = () => (crypto.randomUUID ? crypto.randomUUID().replace(/-/g, "").slice(0, 16) : Math.random().toString(36).slice(2, 12));
  const norm = s => (s || "").trim().toLowerCase().replace(/\s+/g, " ");
  const now = () => Date.now();

  JV.DIMS = ["ux", "ui", "research", "product", "ai", "code", "systems", "brand"];
  JV.STATUSES = ["waiting", "no_reply", "rejected", "interview", "offer"];
  JV.ANALYSIS_VERSION = 2;

  // ---------- migration v1 -> v2 ----------
  function migrate() {
    let changed = false;
    for (const r of state.regions) if (!r.updatedAt) { r.updatedAt = Date.parse(r.createdAt) || now(); state.dirty[r.id] = "region"; changed = true; }
    for (const e of state.entries) {
      if (e.v >= 2) continue;
      const t = Date.parse(e.date) || now();
      e.v = 2; e.createdAt = e.createdAt || e.date; e.updatedAt = t;
      e.statusHistory = e.status ? [{ status: e.status, at: e.date }] : [];
      e.source = e.source || {};
      if (!e.skills?.length && e.keywords?.length) e.skills = e.keywords;
      e.skills = (e.skills || []).map(k => JV.canonSkill ? JV.canonSkill(k) : k);
      e.ai = (e.focus || e.skills?.length) ? { version: 1, at: e.date, roleType: e.roleType || "", seniority: e.seniority || "",
        focus: e.focus || null, skills: e.skills || [], skillsRaw: e.keywords || e.skills || [] } : null;
      e.edited = e.edited || [];
      delete e.keywords;
      state.dirty[e.id] = "entry"; changed = true;
    }
    if (state.schema !== SCHEMA) { state.schema = SCHEMA; changed = true; }
    if (changed) save();
  }

  function touch(obj, kind) { obj.updatedAt = now(); state.dirty[obj.id] = kind; }

  // Apply an AI analysis to an entry, without overwriting fields the user edited.
  function applyAI(e, d, meta) {
    const skillsRaw = (d.skills || []).filter(Boolean);
    e.ai = { model: meta?.model || "", version: JV.ANALYSIS_VERSION, at: new Date().toISOString(),
      roleType: d.roleType || "", seniority: d.seniority || "", focus: d.focus || null,
      skills: [...new Set(skillsRaw.map(JV.canonSkill))], skillsRaw };
    for (const k of ["roleType", "seniority", "focus", "skills"]) if (!e.edited.includes(k)) e[k] = e.ai[k];
  }

  JV.store = {
    state, save, uid, norm,
    onChange(f) { listeners.push(f); },
    regionName(id) { return state.regions.find(r => r.id === id)?.name || ""; },
    // Find a region by name, or create it (so the map grows a new area).
    region(name) {
      if (!name) name = state.regions[0]?.name || "—";
      let r = state.regions.find(x => norm(x.name) === norm(name));
      if (!r) { r = { id: uid(), name, slot: state.regions.length, createdAt: new Date().toISOString() }; touch(r, "region"); state.regions.push(r); }
      return r;
    },
    addEntries(drafts) {
      for (const d of drafts) {
        const r = this.region(d.region), iso = new Date().toISOString();
        const e = {
          id: uid(), v: 2, createdAt: iso, date: d.date || iso, type: d.type || "apply", title: d.title || "",
          company: d.company || "", role: d.role || "", regionId: r.id, insight: d.insight || "",
          next: d.nextText ? { date: d.nextDate || "", text: d.nextText } : null,
          status: (d.type || "apply") === "apply" ? "waiting" : null,
          statusHistory: (d.type || "apply") === "apply" ? [{ status: "waiting", at: iso }] : [],
          roleType: "", seniority: "", focus: null, skills: [],
          source: d.source || {}, ai: null, edited: [],
        };
        if (d.roleType || d.focus || d.skills?.length) applyAI(e, d, d._meta);
        touch(e, "entry");
        state.entries.push(e);
      }
      save();
    },
    // Hand edits from the editor. Fields listed here are protected from later re-analysis.
    updateEntry(id, patch) {
      const e = state.entries.find(x => x.id === id); if (!e) return;
      for (const [k, v] of Object.entries(patch)) {
        if (JSON.stringify(e[k]) === JSON.stringify(v)) continue;
        if (k === "status" && v !== e.status) e.statusHistory = [...(e.statusHistory || []), { status: v, at: new Date().toISOString() }];
        if (k === "region") { e.regionId = this.region(v).id; continue; }
        e[k] = k === "skills" ? [...new Set(v.map(JV.canonSkill).filter(Boolean))] : v;
        if (["roleType", "seniority", "focus", "skills"].includes(k) && !e.edited.includes(k)) e.edited.push(k);
      }
      touch(e, "entry"); save();
    },
    reanalyzed(id, d, meta, { resetEdits = false } = {}) {
      const e = state.entries.find(x => x.id === id); if (!e) return;
      if (resetEdits) e.edited = [];
      applyAI(e, d, meta); touch(e, "entry"); save();
    },
    removeEntry(id) {
      const i = state.entries.findIndex(x => x.id === id); if (i < 0) return;
      state.entries.splice(i, 1);
      state.tombstones.push({ id, kind: "entry", updatedAt: now() }); state.dirty[id] = "entry";
      save();
    },
    // Same company and role (or title) logged in the last 60 days.
    findDuplicate(d) {
      const co = norm(d.company), ro = norm(d.role || d.title); if (!co || !ro) return null;
      const since = now() - 60 * 864e5;
      return state.entries.find(e => e.type === "apply" && norm(e.company) === co && (norm(e.role) === ro || norm(e.title) === ro || norm(e.title).includes(ro))
        && Date.parse(e.date) >= since) || null;
    },
    stats(days = 7) {
      const since = now() - days * 864e5;
      const recent = state.entries.filter(e => Date.parse(e.date) >= since);
      const by = t => recent.filter(e => e.type === t).length;
      return { apply: by("apply"), connect: by("connect"), make: by("make"), learn: by("learn"), rest: by("rest"),
        total: recent.length, allTime: state.entries.length, regions: state.regions.map(r => r.name) };
    },
    weekNumber() { return Math.max(1, Math.floor((now() - new Date(state.startedAt).getTime()) / (7 * 864e5)) + 1); },

    // ---------- backup ----------
    exportJSON() {
      return { app: "waymark", schema: SCHEMA, exportedAt: new Date().toISOString(),
        startedAt: state.startedAt, regions: state.regions, entries: state.entries, tombstones: state.tombstones };
    },
    // Merge a backup or a sync batch: for each item, the newer updatedAt wins. Returns how many changed.
    merge(items, { markDirty = false } = {}) {
      let n = 0;
      for (const it of items) {
        const list = it.kind === "region" ? state.regions : state.entries;
        const i = list.findIndex(x => x.id === it.id);
        const cur = i >= 0 ? list[i] : state.tombstones.find(t => t.id === it.id);
        if (cur && (cur.updatedAt || 0) >= (it.updatedAt || 0)) continue;
        if (it.deleted) {
          if (i >= 0) list.splice(i, 1);
          if (!state.tombstones.find(t => t.id === it.id)) state.tombstones.push({ id: it.id, kind: it.kind, updatedAt: it.updatedAt });
        } else {
          const obj = it.data; obj.updatedAt = it.updatedAt;
          if (i >= 0) list[i] = obj; else list.push(obj);
          state.tombstones = state.tombstones.filter(t => t.id !== it.id);
        }
        if (markDirty) state.dirty[it.id] = it.kind;
        n++;
      }
      if (n) { migrate(); save(); }
      return n;
    },
    // Delete everything this app keeps in this browser (the access code stays, so the app still works).
    wipeLocal() {
      try { for (const k of Object.keys(localStorage)) if (k.startsWith("waymark.") && k !== "waymark.token") localStorage.removeItem(k); } catch { /* storage off */ }
    },
    importJSON(obj) {
      if (!obj || obj.app !== "waymark" || !Array.isArray(obj.entries)) throw new Error("not a Waymark backup");
      if (obj.startedAt && Date.parse(obj.startedAt) < Date.parse(state.startedAt)) state.startedAt = obj.startedAt;
      const items = [
        ...(obj.regions || []).map(r => ({ kind: "region", id: r.id, updatedAt: r.updatedAt || Date.parse(r.createdAt) || 1, data: r })),
        ...obj.entries.map(e => ({ kind: "entry", id: e.id, updatedAt: e.updatedAt || Date.parse(e.date) || 1, data: e })),
        ...(obj.tombstones || []).map(t => ({ kind: t.kind, id: t.id, updatedAt: t.updatedAt, deleted: true })),
      ];
      return this.merge(items, { markDirty: true });
    },
  };

  JV.store.migrate = migrate;
})();
