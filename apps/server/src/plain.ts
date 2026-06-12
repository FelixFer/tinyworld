import { EXHIBITS, type Exhibit } from "@tinyworld/world";

const NAME = "Felix Ferdinand";
const TAGLINE = "Frontend engineer building web apps with React and TypeScript.";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function paragraphs(body: string): string {
  return body
    .split("\n\n")
    .map((p) => `<p>${esc(p)}</p>`)
    .join("\n");
}

function tagList(tags?: string[]): string {
  if (!tags?.length) return "";
  return `<ul class="tags">${tags.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>`;
}

function linkList(links: Exhibit["links"]): string {
  if (!links.length) return "";
  const items = links
    .map((l) => {
      const external = l.url.startsWith("http");
      const attrs = external ? ' target="_blank" rel="noopener noreferrer"' : "";
      return `<li><a href="${esc(l.url)}"${attrs}>${esc(l.label)}</a></li>`;
    })
    .join("");
  return `<ul class="links">${items}</ul>`;
}

function images(ex: Exhibit): string {
  if (!ex.images?.length) return "";
  const imgs = ex.images
    .map((src) => `<img src="${esc(src)}" alt="${esc(ex.title)} screenshot" loading="lazy" />`)
    .join("");
  return `<div class="shots">${imgs}</div>`;
}

function projectArticle(ex: Exhibit): string {
  return `<article>
      <h3>${esc(ex.title)}</h3>
      ${paragraphs(ex.body)}
      ${images(ex)}
      ${tagList(ex.tags)}
      ${linkList(ex.links)}
    </article>`;
}

/** Server-rendered, JS-free portfolio page for crawlers, ATS parsers, and screen readers. */
export function renderPlainPage(): string {
  const projects = EXHIBITS.filter((e) => e.kind === "project" || e.kind === "meta");
  const about = EXHIBITS.find((e) => e.kind === "about");
  const contact = EXHIBITS.find((e) => e.kind === "contact");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Tinyworld by ${esc(NAME)}</title>
  <meta name="description" content="${esc(TAGLINE)}" />
  <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
  <style>
    :root { color-scheme: dark; }
    body { margin: 0 auto; max-width: 720px; padding: 32px 20px 64px; background: #14141f; color: #e8e8f0; font: 16px/1.6 system-ui, -apple-system, sans-serif; }
    a { color: #4ecdc4; }
    h1 { font-size: 28px; margin: 0 0 4px; }
    h2 { font-size: 20px; margin: 40px 0 8px; border-bottom: 1px solid #33334a; padding-bottom: 6px; }
    h3 { font-size: 18px; margin: 24px 0 4px; }
    p { margin: 8px 0; }
    .lede { color: #b8b8c8; }
    ul.tags, ul.links { list-style: none; padding: 0; display: flex; flex-wrap: wrap; gap: 8px; margin: 10px 0; }
    ul.links { gap: 16px; }
    .tags li { background: rgba(78,205,196,0.15); color: #4ecdc4; font-size: 13px; padding: 2px 9px; border-radius: 999px; }
    .shots { display: flex; flex-wrap: wrap; gap: 8px; margin: 12px 0; }
    .shots img { height: 200px; width: auto; border-radius: 6px; border: 1px solid #33334a; }
    footer { margin-top: 48px; color: #8a8a9a; font-size: 14px; }
  </style>
</head>
<body>
  <header>
    <h1>${esc(NAME)}</h1>
    <p class="lede">${esc(TAGLINE)}</p>
    <p><a href="/">Enter the interactive world →</a></p>
  </header>
  <main>
    <section aria-labelledby="projects-h">
      <h2 id="projects-h">Projects</h2>
      ${projects.map(projectArticle).join("\n      ")}
    </section>
    ${about ? `<section aria-labelledby="about-h">\n      <h2 id="about-h">About</h2>\n      ${paragraphs(about.body)}\n    </section>` : ""}
    ${contact ? `<section aria-labelledby="contact-h">\n      <h2 id="contact-h">Contact</h2>\n      ${paragraphs(contact.body)}\n      ${linkList(contact.links)}\n    </section>` : ""}
  </main>
  <footer>
    <p>This is a plain-HTML version of an interactive portfolio. <a href="/">Visit the world →</a></p>
  </footer>
</body>
</html>`;
}
