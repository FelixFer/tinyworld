// Discord webhook — pings you when a visitor walks into an empty world
// ("someone is reading your resume — go say hi"). The killer interview demo.
//
// Disabled unless DISCORD_WEBHOOK_URL is set (same pattern as ADMIN_PASS), and
// rate-limited so it never spams: it fires only on the empty -> first-visitor
// transition, at most once per cooldown window. The env var is read lazily so
// import order vs env.ts never matters.

const COOLDOWN_MS = 5 * 60 * 1000; // at most one ping per 5 min
let lastNotifyAt = 0;

/**
 * Notify on the empty -> first-visitor transition. No-op when the webhook env
 * var is unset, when the world already had visitors, or within the cooldown.
 */
export function notifyVisitor(name: string, activePlayers: number): void {
  const url = process.env.DISCORD_WEBHOOK_URL;
  if (!url) return;
  if (activePlayers !== 1) return; // only when the newcomer is the only one here
  const now = Date.now();
  if (now - lastNotifyAt < COOLDOWN_MS) return;
  lastNotifyAt = now;

  const content = `👀 **someone is reading your resume** — go say hi! **${name}** just walked into tinyworld.\nhttps://tinyworld.up.railway.app`;

  fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ content }),
  }).catch((e) => console.error("discord webhook failed", e));
}
