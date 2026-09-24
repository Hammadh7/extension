/**
 * TikTok Creative Center trend scraper.
 *
 * The trends API (ads.tiktok.com/creative_radar_api/...) needs three headers the
 * page's own JS signs: anonymous-user-id, timestamp, user-sign. Rather than
 * reimplementing that signing, we drive a real browser and INTERCEPT the JSON
 * the page already fetches for itself. Nothing to reverse-engineer, nothing to
 * keep in sync when they rotate the algorithm.
 *
 * Runs on a GitHub Actions US runner because TikTok geo-blocks India.
 *
 * Env:
 *   COUNTRY   country_code to read, default US
 *   PERIOD    7 | 30 | 120  (days), default 7
 *   OUT_DIR   default data/
 *   HEADLESS  "false" to watch it locally
 */
import fs from "node:fs";
import path from "node:path";
import { chromium, type Browser, type Page } from "playwright";

const COUNTRY = process.env.COUNTRY || "US";
const PERIOD = process.env.PERIOD || "7";
const OUT_DIR = process.env.OUT_DIR || "data";
const HEADLESS = process.env.HEADLESS !== "false";
const BASE = "https://ads.tiktok.com/business/creativecenter/inspiration/popular";

interface Captured { endpoint: string; payload: any }

const TARGETS = [
  { key: "hashtag", url: `${BASE}/hashtag/pc/en?countryCode=${COUNTRY}&period=${PERIOD}` },
  { key: "song",    url: `${BASE}/music/pc/en?countryCode=${COUNTRY}&period=${PERIOD}` },
];

/** Pull the item list out of whatever shape the endpoint returned. */
function itemsOf(payload: any): any[] {
  const d = payload?.data ?? payload;
  for (const k of ["list", "hashtag_list", "music_list", "sound_list", "items"]) {
    if (Array.isArray(d?.[k])) return d[k];
  }
  return Array.isArray(d) ? d : [];
}

/** Keep the fields that matter for trend detection; carry the rest through. */
function normalise(kind: string, raw: any) {
  const pick = (...keys: string[]) => {
    for (const k of keys) if (raw?.[k] !== undefined && raw?.[k] !== null) return raw[k];
    return null;
  };
  return {
    kind,
    country: COUNTRY,
    period_days: Number(PERIOD),
    id: pick("hashtag_id", "music_id", "id", "song_id"),
    name: pick("hashtag_name", "music_name", "title", "name"),
    rank: pick("rank", "rank_index"),
    rank_diff: pick("rank_diff", "rank_change", "trend_diff"),
    is_new: pick("is_new", "new"),
    is_promoted: pick("is_promoted", "promoted"),
    video_count: pick("video_views", "publish_cnt", "video_count", "post_count"),
    view_count: pick("view_count", "video_views", "play_count"),
    author: pick("author", "singer", "creator"),
    link: pick("link", "url", "share_url"),
    raw,
  };
}

async function harvest(page: Page, key: string, url: string): Promise<any[]> {
  const captured: Captured[] = [];

  page.on("response", async (resp) => {
    const u = resp.url();
    if (!u.includes("creative_radar_api")) return;
    try {
      const json = await resp.json();
      captured.push({ endpoint: u, payload: json });
    } catch { /* non-JSON (redirect, preflight) — ignore */ }
  });

  console.log(`  [${key}] opening ${url}`);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90_000 });
  // The list renders from XHR, so give it a beat, then scroll to trigger more.
  await page.waitForTimeout(6000);
  for (let i = 0; i < 6; i++) {
    await page.mouse.wheel(0, 3000);
    await page.waitForTimeout(1500);
    // "View more" pulls the next page of ranks on both tabs.
    const more = page.locator('text=/view more/i').first();
    if (await more.count().catch(() => 0)) {
      await more.click({ timeout: 4000 }).catch(() => {});
      await page.waitForTimeout(2500);
    }
  }

  const rows: any[] = [];
  const seen = new Set<string>();
  for (const c of captured) {
    for (const it of itemsOf(c.payload)) {
      const n = normalise(key, it);
      const dedupKey = String(n.id ?? n.name ?? JSON.stringify(it).slice(0, 80));
      if (seen.has(dedupKey)) continue;
      seen.add(dedupKey);
      rows.push(n);
    }
  }
  console.log(`  [${key}] ${captured.length} api responses → ${rows.length} unique items`);
  if (!rows.length && captured.length) {
    console.log(`  [${key}] responses aaye par items nahi mile — shape badla ho sakta hai:`);
    console.log("   ", JSON.stringify(captured[0].payload).slice(0, 300));
  }
  return rows;
}

const esc = (v: any) => {
  const s = v === null || v === undefined ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

async function main() {
  const stamp = new Date().toISOString().slice(0, 10);
  fs.mkdirSync(OUT_DIR, { recursive: true });

  let browser: Browser | null = null;
  const all: any[] = [];
  try {
    browser = await chromium.launch({ headless: HEADLESS });
    const ctx = await browser.newContext({
      locale: "en-US",
      timezoneId: "America/New_York",
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      viewport: { width: 1440, height: 900 },
    });
    for (const t of TARGETS) {
      const page = await ctx.newPage();
      try {
        all.push(...(await harvest(page, t.key, t.url)));
      } catch (e: any) {
        console.error(`  [${t.key}] FAIL: ${String(e?.message ?? e).slice(0, 200)}`);
      } finally {
        await page.close().catch(() => {});
      }
    }
  } finally {
    await browser?.close().catch(() => {});
  }

  if (!all.length) {
    console.error("\n  kuch nahi mila — TikTok ne block kiya ya page ka shape badla. exit 1");
    process.exit(1);
  }

  const jsonPath = path.join(OUT_DIR, `${stamp}-${COUNTRY}-${PERIOD}d.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(all, null, 2));

  const COLS = ["kind","country","period_days","rank","rank_diff","is_new","name","id",
                "video_count","view_count","author","link"];
  const csvPath = path.join(OUT_DIR, `${stamp}-${COUNTRY}-${PERIOD}d.csv`);
  fs.writeFileSync(csvPath,
    [COLS.join(","), ...all.map((r) => COLS.map((c) => esc(r[c])).join(","))].join("\n") + "\n");

  const byKind = all.reduce<Record<string, number>>((a, r) => ((a[r.kind] = (a[r.kind] ?? 0) + 1), a), {});
  console.log(`\n  ${JSON.stringify(byKind)}  kul=${all.length}`);
  console.log(`  ${jsonPath}`);
  console.log(`  ${csvPath}`);
}

await main();
