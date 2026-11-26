// Talks to the Waymark Worker (Cloudflare) that holds the Gemini key.
// With no AI_URL configured, it runs a small built-in demo so the app still works.
window.JV = window.JV || {};
(function () {
  const cfg = window.JV_CONFIG || {};
  JV.aiEnabled = !!cfg.AI_URL;
  // The access code lives only in this browser, never in the code on GitHub.
  JV.getToken = () => { try { return localStorage.getItem("waymark.token") || ""; } catch { return ""; } };
  JV.setToken = v => { try { localStorage.setItem("waymark.token", v); } catch { /* storage off */ } };

  JV.ask = async function (message, opts = {}) {
    const s = JV.store.state;
    const payload = {
      message, lang: s.lang, quiet: opts.mode === "analyze" ? true : s.quiet, mode: opts.mode || "chat",
      history: opts.mode === "analyze" ? [] : s.chat.slice(-10).map(m => ({ role: m.role, text: m.text })),
      regions: s.regions.map(r => r.name),
      stats: JV.store.stats(7),
      today: new Date().toISOString().slice(0, 10),
    };
    if (!JV.aiEnabled) return demo(message);
    const res = await fetch(cfg.AI_URL, {
      method: "POST",
      headers: Object.assign({ "Content-Type": "application/json" },
        JV.getToken() ? { "x-waymark-token": JV.getToken() } : {},
        cfg.SUPABASE_ANON_KEY ? { Authorization: `Bearer ${cfg.SUPABASE_ANON_KEY}`, apikey: cfg.SUPABASE_ANON_KEY } : {}),
      body: JSON.stringify(payload),
    });
    if (!res.ok) { const e = new Error("AI " + res.status); e.status = res.status; throw e; }
    const data = await res.json();
    return { reply: data.reply || "", quickReplies: data.quickReplies || [], entries: data.entries || [], model: data.model || "" };
  };
  // Re-run the skill analysis on a job post that is already saved.
  JV.analyze = text => JV.ask(text, { mode: "analyze" });

  // ---- demo mode: keyword rules, no AI ----
  const RULES = [
    { type: "connect", re: /(聊|认识|coffee|fika|meetup|event|活动|私信|联系|met|talked|chat|träff|pratade)/i },
    { type: "make", re: /(作品集|portfolio|app|做了|built|made|case study|byggde|skapade)/i },
    { type: "learn", re: /(学|复盘|面试|learn|course|interview|lärde|intervju)/i },
    { type: "rest", re: /(休息|rest|break|vila|ledig)/i },
  ];
  const Q = {
    zh: { apply: "记下了。这份你有改作品集或简历吗？", connect: "记下了。聊完有什么让你印象深的吗？", make: "记下了，这算一次创作。做的是什么？", learn: "记下了。一句话说说收获？", rest: "休息也是赶路的一部分，记下了。", qr: ["有改", "没改", "先跳过"] },
    en: { apply: "Logged. Did you tailor your portfolio or CV for this one?", connect: "Logged. Anything from that conversation that stuck with you?", make: "Logged as a build. What did you make?", learn: "Logged. One line on what you took away?", rest: "Rest is part of the trip. Logged.", qr: ["Yes", "No", "Skip"] },
    sv: { apply: "Noterat. Anpassade du portfolion eller CV:t för den här?", connect: "Noterat. Något från samtalet som fastnade?", make: "Noterat som ett bygge. Vad gjorde du?", learn: "Noterat. En rad om vad du tog med dig?", rest: "Vila är en del av resan. Noterat.", qr: ["Ja", "Nej", "Hoppa över"] },
  };
  function demo(message) {
    const s = JV.store.state, q = Q[s.lang] || Q.zh;
    const url = message.match(/https?:\/\/\S+/)?.[0];
    if (!url && q.qr.includes(message.trim())) {
      const ok = { zh: "好的，记住了。", en: "Got it.", sv: "Uppfattat." }[s.lang];
      return Promise.resolve({ reply: ok, quickReplies: [], entries: [] });
    }
    let type = url ? "apply" : (RULES.find(r => r.re.test(message))?.type || "apply");
    let title = message.replace(/https?:\/\/\S+/g, "").trim().slice(0, 60);
    if (url) { try { title = new URL(url).hostname.replace(/^www\./, ""); } catch { /* keep text */ } }
    const region = s.regions[0]?.name || ({ zh: "第一个方向", en: "First direction", sv: "Första riktningen" })[s.lang];
    return new Promise(res => setTimeout(() => res({
      reply: q[type], quickReplies: type === "apply" && !s.quiet ? q.qr : [],
      entries: [{ type, title: title || q[type], region }],
    }), 350));
  }
})();
