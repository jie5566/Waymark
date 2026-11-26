// Skill names: one canonical name per skill, so statistics don't split "prototyping" and "figma prototyping".
// Add synonyms here as they show up. Keys and values are lower case.
window.JV = window.JV || {};
(function () {
  const GROUPS = {
    "prototyping": ["prototype", "prototypes", "figma prototyping", "prototyping in figma", "interactive prototyping", "rapid prototyping", "prototyping with figma"],
    "figma": ["figma design", "figma ui", "figjam"],
    "design systems": ["design system", "component library", "component libraries", "ui components", "design tokens", "contributing to design system"],
    "usability testing": ["usability tests", "usability test", "user testing", "user tests", "usability studies"],
    "user research": ["ux research", "user interviews", "qualitative research", "research"],
    "ux design": ["user experience", "user experience design", "ux"],
    "ui design": ["user interface design", "ui", "interface design"],
    "interaction design": ["ixd", "interaction"],
    "visual design": ["visual", "graphic ui"],
    "wireframing": ["wireframes", "wireframe"],
    "llms": ["llm", "large language models", "large language model", "llm-based features", "llm ux", "llm features"],
    "generative ai": ["genai", "gen ai", "generative ai products"],
    "ai tools": ["ai-powered tools", "ai design tools", "ai prototyping tools", "ai prototyping"],
    "prompt design": ["prompt engineering", "prompting", "prompt writing"],
    "agent design": ["ai agents", "agentic ux", "agent ux"],
    "accessibility": ["a11y", "wcag", "inclusive design"],
    "a/b testing": ["ab testing", "a/b tests", "experimentation"],
    "html/css": ["html & css", "html and css", "html", "css"],
    "javascript": ["js"],
    "react": ["react.js", "reactjs"],
    "product strategy": ["strategy", "product thinking"],
    "stakeholder management": ["stakeholder communication", "working with stakeholders"],
    "design thinking": [],
    "information architecture": ["ia"],
    "motion design": ["animation", "motion"],
    "data analysis": ["analytics", "data-driven design"],
  };
  const MAP = {};
  for (const [canon, syns] of Object.entries(GROUPS)) { MAP[canon] = canon; syns.forEach(s => MAP[s] = canon); }
  JV.canonSkill = raw => {
    const s = String(raw || "").trim().toLowerCase().replace(/\s+/g, " ").replace(/[.;,]+$/, "");
    return MAP[s] || s;
  };
})();
