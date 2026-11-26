// Waymark · watched companies
// Most company career pages are hosted by an applicant tracking system that also serves the same jobs
// as a public feed, the one the careers page itself reads. Paste a careers link in the app and this file
// works out which system it is, then reads that feed once a day. No keys, no logins, no page scraping.
//
// Supported: Teamtailor (common in the Nordics, also on custom domains), Greenhouse, Lever, Ashby.

const UA = { "User-Agent": "WaymarkBot (personal job journal)", accept: "application/json" };

// Careers link -> { ats, key, feed, page }. Returns null when the system isn't recognised.
export async function detectCompany(input) {
  let u;
  try { u = new URL(/^https?:\/\//i.test(input) ? input : "https://" + input); } catch { return null; }
  const host = u.hostname.toLowerCase(), first = u.pathname.split("/").filter(Boolean)[0] || "";
  let m;
  if ((m = host.match(/^([a-z0-9-]+)\.teamtailor\.com$/)) && m[1] !== "www" && m[1] !== "app")
    return tt(`https://${host}`);
  if (/^(boards|job-boards)(\.eu)?\.greenhouse\.io$/.test(host) && first)
    return { ats: "greenhouse", key: first, feed: `https://${host.includes(".eu.") ? "boards-api.eu" : "boards-api"}.greenhouse.io/v1/boards/${first}/jobs?content=true`, page: `https://${host}/${first}` };
  if (/^jobs(\.eu)?\.lever\.co$/.test(host) && first)
    return { ats: "lever", key: first, feed: `https://${host.includes(".eu.") ? "api.eu" : "api"}.lever.co/v0/postings/${first}?mode=json`, page: `https://${host}/${first}` };
  if (host === "jobs.ashbyhq.com" && first)
    return { ats: "ashby", key: first, feed: `https://api.ashbyhq.com/posting-api/job-board/${first}`, page: `https://jobs.ashbyhq.com/${first}` };
  // Anything else: many Nordic companies run Teamtailor on their own domain (careers.example.com).
  const guess = tt(u.origin);
  try {
    const res = await fetch(guess.feed, { headers: UA });
    if (res.ok && /json/.test(res.headers.get("content-type") || "")) {
      const d = await res.json();
      if (Array.isArray(d.items)) return guess;
    }
  } catch { /* not Teamtailor */ }
  return null;
}
const tt = origin => ({ ats: "teamtailor", key: new URL(origin).hostname, feed: `${origin}/jobs.json`, page: `${origin}/jobs` });

// Read one company's open jobs, in the same shape as Platsbanken jobs (see jobs.js).
export async function fetchCompany(c) {
  const res = await fetch(c.feed, { headers: UA });
  if (!res.ok) throw new Error(`${c.ats} ${res.status}`);
  const d = await res.json();
  const name = c.name;
  if (c.ats === "teamtailor") return (d.items || []).map(it => {
    const jp = it._jobposting || {}, places = [].concat(jp.jobLocation || []);
    const loc = places.map(p => [p.address?.addressLocality, p.address?.addressCountry].filter(Boolean).join(", ")).filter(Boolean).join(" / ");
    return job(c, it.id || it.url, it.title, name || jp.hiringOrganization?.name || d.title, loc, it.url, it.url, "", it.date_published, html2text(it.content_html));
  });
  if (c.ats === "greenhouse") return (d.jobs || []).map(j =>
    job(c, j.id, j.title, name, j.location?.name, j.absolute_url, j.absolute_url, "", j.updated_at, html2text(decodeEntities(j.content || ""))));
  if (c.ats === "lever") return (Array.isArray(d) ? d : []).map(j =>
    job(c, j.id, j.text, name, j.categories?.location || (j.categories?.allLocations || []).join(" / "), j.hostedUrl, j.applyUrl || j.hostedUrl, "",
      j.createdAt ? new Date(j.createdAt).toISOString() : "", j.descriptionPlain || html2text(j.description || "")));
  if (c.ats === "ashby") return (d.jobs || []).filter(j => j.isListed !== false).map(j =>
    job(c, j.id || j.jobUrl, j.title, name, [j.location, j.isRemote ? "Remote" : ""].filter(Boolean).join(" · "), j.jobUrl, j.applyUrl || j.jobUrl, "", j.publishedAt, j.descriptionPlain || html2text(j.descriptionHtml || "")));
  return [];
}

function job(c, id, title, company, location, url, applyUrl, deadline, published, text) {
  return {
    id: `${c.ats}:${c.key}:${id}`.slice(0, 200), source: c.ats, company: String(company || c.key).slice(0, 120),
    title: String(title || "").slice(0, 160), location: String(location || "").slice(0, 120),
    url: String(url || "").slice(0, 500), apply_url: String(applyUrl || "").slice(0, 500),
    deadline, published: String(published || "").slice(0, 19), text: String(text || "").slice(0, 12000),
  };
}

// A company's whole board can be hundreds of roles worldwide: keep design roles in the area you search.
const DESIGN_TITLE = /design|\bux\b|\bui\b|user research|researcher|interaktion|formgiv|användarupplevelse|kreativ|creative/i;
export function keepCompanyJob(j, placeWords) {
  if (!DESIGN_TITLE.test(j.title)) return false;
  if (!j.location) return true;
  const loc = j.location.toLowerCase();
  return placeWords.some(w => loc.includes(w));
}

// A readable name from the feed when the user didn't type one.
export async function companyName(c) {
  try {
    const res = await fetch(c.feed, { headers: UA }); if (!res.ok) return null;
    const d = await res.json();
    if (c.ats === "teamtailor") return { name: d.items?.[0]?._jobposting?.hiringOrganization?.name || String(d.title || "").replace(/\s*[-–|].*$/, "") || c.key, count: (d.items || []).length };
    const n = c.ats === "lever" ? (Array.isArray(d) ? d.length : 0) : (d.jobs || []).length;
    return { name: c.key.replace(/[-_]+/g, " ").replace(/\b\w/g, s => s.toUpperCase()), count: n };
  } catch { return null; }
}

function decodeEntities(s) {
  return s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
}
function html2text(h) {
  return decodeEntities(String(h || "").replace(/<(br|\/p|\/li|\/h\d)[^>]*>/gi, "\n").replace(/<li[^>]*>/gi, "• ").replace(/<[^>]+>/g, " "))
    .replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
}
