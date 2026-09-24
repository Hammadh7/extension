/**
 * Hashtag → videos → filter → download.
 *
 * Creative Center sirf hashtag ki ranked list deta hai, videos nahi. Videos
 * www.tiktok.com/tag/<name> par hain. Wo host India se blocked hai, isliye ye
 * GitHub ke US runner par chalta hai (probe me verify kiya: HTTP 200, ek page se
 * ~118 video links).
 *
 * Download sirf un videos ka hota hai jo bar paar karte hain — default
 * 1M+ likes YA 10M+ views. Sab download karna mehnga hai aur zyadatar kachra.
 *
 * Env:
 *   HASHTAGS     comma-separated, bina '#'
 *   MIN_LIKES    default 1000000
 *   MIN_VIEWS    default 10000000
 *   MAX_PER_TAG  har tag se kitne videos dekhein, default 200
 *   DOWNLOAD     "false" rakho to sirf metadata, koi file nahi
 *   OUT_DIR      default data
 *   VIDEO_DIR    default data/videos
 */
import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { chromium, type Browser, type Page } from "playwright";

const execFileAsync = promisify(execFile);

const HASHTAGS = (process.env.HASHTAGS || "wholesome,drake,manga,sukuna,chainsawman")
  .split(",").map((s) => s.trim().replace(/^#/, "")).filter(Boolean);
const MIN_LIKES = Number(process.env.MIN_LIKES || 1_000_000);
const MIN_VIEWS = Number(process.env.MIN_VIEWS || 10_000_000);
const MAX_PER_TAG = Number(process.env.MAX_PER_TAG || 200);
const DOWNLOAD = process.env.DOWNLOAD !== "false";
const OUT_DIR = process.env.OUT_DIR || "data";
const VIDEO_DIR = process.env.VIDEO_DIR || path.join(OUT_DIR, "videos");

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

interface Vid {
  id: string; url: string; hashtag: string;
  author: string | null; author_id: string | null;
  likes: number; views: number; comments: number; shares: number;
  desc: string; music: string | null; music_id: string | null;
  duration: number | null; created: string | null;
  passes: boolean; downloaded?: string;
}

/** TikTok ka item object jahan bhi mile, uthao — response shape badalta rehta hai. */
function harvestItems(obj: any, out: Map<string, any>, depth = 0) {
  if (!obj || depth > 10 || out.size > 2000) return;
  if (Array.isArray(obj)) { for (const x of obj) harvestItems(x, out, depth + 1); return; }
  if (typeof obj !== "object") return;
  // ek video item: id + author + stats
  if (obj.id && obj.author && (obj.stats || obj.statsV2)) out.set(String(obj.id), obj);
  for (const k of Object.keys(obj)) harvestItems(obj[k], out, depth + 1);
}

const num = (v: any) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

function toVid(hashtag: string, it: any): Vid {
  const s = it.statsV2 ?? it.stats ?? {};
  const author = typeof it.author === "string" ? it.author : it.author?.uniqueId ?? null;
  const likes = num(s.diggCount);
  const views = num(s.playCount);
  return {
    id: String(it.id),
    url: `https://www.tiktok.com/@${author ?? "i"}/video/${it.id}`,
    hashtag,
    author,
    author_id: it.author?.id ?? null,
    likes, views,
    comments: num(s.commentCount),
    shares: num(s.shareCount),
    desc: String(it.desc ?? "").replace(/\s+/g, " ").slice(0, 500),
    music: it.music?.title ?? null,
    music_id: it.music?.id ?? null,
    duration: it.video?.duration ?? null,
    created: it.createTime ? new Date(num(it.createTime) * 1000).toISOString() : null,
    passes: likes >= MIN_LIKES || views >= MIN_VIEWS,
  };
}

async function scrapeTag(page: Page, tag: string): Promise<Vid[]> {
  const items = new Map<string, any>();

  page.on("response", async (r) => {
    const u = r.url();
    if (!/\/api\/(challenge|search|post|recommend|item)/.test(u)) return;
    try { harvestItems(await r.json(), items); } catch { /* non-JSON */ }
  });

  const url = `https://www.tiktok.com/tag/${encodeURIComponent(tag)}`;
  console.log(`\n  [#${tag}] ${url}`);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.waitForTimeout(5000);

  // hydration blob me pehla batch hota hai
  try {
    const h = await page.evaluate(() => {
      const el = document.querySelector("#__UNIVERSAL_DATA_FOR_REHYDRATION__");
      return el?.textContent ? JSON.parse(el.textContent) : null;
    });
    if (h) harvestItems(h, items);
  } catch { /* ignore */ }

  for (let i = 0; i < 12 && items.size < MAX_PER_TAG; i++) {
    const body = (await page.content()).toLowerCase();
    if (body.includes("captcha") || body.includes("unusual traffic")) {
      console.log(`  [#${tag}] ⚠️  captcha — is tag ko chhod kar aage badh raha hoon`);
      break;
    }
    await page.mouse.wheel(0, 4000);
    await page.waitForTimeout(2000 + Math.random() * 1500); // thoda random, robot jaisa na lage
  }

  const vids = [...items.values()].map((it) => toVid(tag, it));
  const pass = vids.filter((v) => v.passes).length;
  console.log(`  [#${tag}] ${vids.length} videos mile, ${pass} bar paar kiye`);
  return vids;
}

async function download(v: Vid): Promise<string | null> {
  const out = path.join(VIDEO_DIR, `${v.hashtag}__${v.id}.mp4`);
  if (fs.existsSync(out)) return out;
  try {
    await execFileAsync("yt-dlp", [
      v.url, "-o", out, "--no-warnings", "--no-playlist",
      "-f", "mp4/best", "--retries", "3", "--socket-timeout", "30",
    ], { timeout: 180_000, maxBuffer: 16 * 1024 * 1024 });
    return fs.existsSync(out) ? out : null;
  } catch (e: any) {
    console.log(`    ✗ download fail ${v.id}: ${String(e?.stderr ?? e?.message ?? e).slice(0, 110)}`);
    return null;
  }
}

const esc = (x: any) => {
  const s = x === null || x === undefined ? "" : String(x);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  if (DOWNLOAD) fs.mkdirSync(VIDEO_DIR, { recursive: true });
  console.log(`  bar: likes >= ${MIN_LIKES.toLocaleString()} YA views >= ${MIN_VIEWS.toLocaleString()}`);
  console.log(`  tags: ${HASHTAGS.join(", ")}`);

  let browser: Browser | null = null;
  const all: Vid[] = [];
  try {
    browser = await chromium.launch({ headless: true });
    for (const tag of HASHTAGS) {
      // har tag ke liye naya context — fingerprint taza rehta hai
      const ctx = await browser.newContext({
        userAgent: UA, locale: "en-US", timezoneId: "America/New_York",
        viewport: { width: 1440, height: 900 },
      });
      const page = await ctx.newPage();
      try {
        all.push(...(await scrapeTag(page, tag)));
      } catch (e: any) {
        console.log(`  [#${tag}] FAIL: ${String(e?.message ?? e).slice(0, 140)}`);
      } finally {
        await ctx.close().catch(() => {});
      }
      await new Promise((r) => setTimeout(r, 4000)); // tags ke beech saans
    }
  } finally {
    await browser?.close().catch(() => {});
  }

  // ek hi video kai tags me aa sakta hai
  const uniq = new Map<string, Vid>();
  for (const v of all) if (!uniq.has(v.id)) uniq.set(v.id, v);
  const vids = [...uniq.values()].sort((a, b) => b.views - a.views);
  const winners = vids.filter((v) => v.passes);

  console.log(`\n  kul unique videos: ${vids.length}`);
  console.log(`  bar paar karne wale: ${winners.length}`);

  if (DOWNLOAD && winners.length) {
    console.log(`\n  download shuru (${winners.length})`);
    let ok = 0;
    for (const v of winners) {
      const p = await download(v);
      if (p) { v.downloaded = p; ok++; }
    }
    console.log(`  downloaded: ${ok}/${winners.length}`);
  } else if (!DOWNLOAD) {
    console.log("  DOWNLOAD=false — sirf metadata");
  }

  const stamp = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(path.join(OUT_DIR, `${stamp}-videos.json`), JSON.stringify(vids, null, 2));
  const COLS: (keyof Vid)[] = ["hashtag","id","url","author","likes","views","comments","shares",
                                "music","music_id","duration","created","passes","downloaded","desc"];
  fs.writeFileSync(path.join(OUT_DIR, `${stamp}-videos.csv`),
    [COLS.join(","), ...vids.map((v) => COLS.map((c) => esc(v[c])).join(","))].join("\n") + "\n");

  console.log(`  ${OUT_DIR}/${stamp}-videos.{json,csv}`);
  if (!vids.length) { console.error("\n  kuch nahi mila — captcha ya shape badla"); process.exit(1); }
}

await main();
