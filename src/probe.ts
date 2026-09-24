/**
 * Probe: kya www.tiktok.com GitHub runner se sach me scrape ho sakta hai?
 *
 * Creative Center sirf ranked list deta hai. Format clustering ke liye ASLI
 * videos chahiye, jo www.tiktok.com par hain. Wo India se blocked hai, par
 * runner US me hai — toh ye sawaal ab khula hai, aur yahi uska jawab dega.
 *
 * Har cheez alag se test hoti hai taaki pata chale ki kya chala aur kya nahi.
 */
import { chromium, type Page } from "playwright";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const results: { test: string; ok: boolean; detail: string }[] = [];
const rec = (test: string, ok: boolean, detail: string) => {
  results.push({ test, ok, detail });
  console.log(`  ${ok ? "✓" : "✗"} ${test.padEnd(34)} ${detail.slice(0, 110)}`);
};

/** Hydration blob = page ne asli data diya. Yahi asli kasauti hai. */
async function hydration(page: Page): Promise<any | null> {
  return page.evaluate(() => {
    const el = document.querySelector("#__UNIVERSAL_DATA_FOR_REHYDRATION__");
    if (!el?.textContent) return null;
    try { return JSON.parse(el.textContent); } catch { return null; }
  });
}

function countVideos(h: any): number {
  let n = 0;
  const dig = (o: any, d = 0) => {
    if (!o || d > 8 || n > 500) return;
    if (Array.isArray(o)) return o.forEach((x) => dig(x, d + 1));
    if (typeof o !== "object") return;
    if (o.id && (o.video || o.desc !== undefined) && o.author) n++;
    for (const k of Object.keys(o)) dig(o[k], d + 1);
  };
  dig(h);
  return n;
}

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  userAgent: UA, locale: "en-US", timezoneId: "America/New_York",
  viewport: { width: 1440, height: 900 },
});

// 1) exit IP — confirm karo ki India se bahar hain
try {
  const p = await ctx.newPage();
  await p.goto("https://ipinfo.io/json", { timeout: 30_000 });
  const j = JSON.parse((await p.textContent("pre")) ?? "{}");
  rec("exit IP", j.country !== "IN", `${j.ip} ${j.city}/${j.country} ${String(j.org).slice(0, 28)}`);
  await p.close();
} catch (e: any) { rec("exit IP", false, String(e?.message ?? e)); }

// 2) tiktok.com khulta hai ya /about par phenkta hai
try {
  const p = await ctx.newPage();
  const resp = await p.goto("https://www.tiktok.com/", { waitUntil: "domcontentloaded", timeout: 60_000 });
  const url = p.url();
  const blocked = url.includes("/about");
  rec("www.tiktok.com", !blocked, `HTTP ${resp?.status()} → ${url.slice(0, 70)}`);
  await p.close();
} catch (e: any) { rec("www.tiktok.com", false, String(e?.message ?? e)); }

// 3) explore page + hydration
try {
  const p = await ctx.newPage();
  await p.goto("https://www.tiktok.com/explore", { waitUntil: "domcontentloaded", timeout: 60_000 });
  await p.waitForTimeout(6000);
  const h = await hydration(p);
  const n = h ? countVideos(h) : 0;
  rec("explore hydration", !!h, h ? `blob mila, ~${n} video objects` : "blob nahi mila");
  await p.close();
} catch (e: any) { rec("explore hydration", false, String(e?.message ?? e)); }

// 4) hashtag page — format scraping ka asli raasta
try {
  const p = await ctx.newPage();
  await p.goto("https://www.tiktok.com/tag/grwm", { waitUntil: "domcontentloaded", timeout: 60_000 });
  await p.waitForTimeout(6000);
  const h = await hydration(p);
  const n = h ? countVideos(h) : 0;
  const links = await p.locator('a[href*="/video/"]').count().catch(() => 0);
  rec("hashtag page /tag/grwm", n > 0 || links > 0, `hydration ~${n} videos, ${links} video links`);
  await p.close();
} catch (e: any) { rec("hashtag page /tag/grwm", false, String(e?.message ?? e)); }

// 5) search API — sabse kaam ka, par sabse zyada guarded
try {
  const p = await ctx.newPage();
  let apiStatus = 0, apiBody = "";
  p.on("response", async (r) => {
    if (r.url().includes("/api/search/") || r.url().includes("/api/post/item_list")) {
      apiStatus = r.status();
      apiBody = (await r.text().catch(() => "")).slice(0, 120);
    }
  });
  await p.goto("https://www.tiktok.com/search?q=grwm", { waitUntil: "domcontentloaded", timeout: 60_000 });
  await p.waitForTimeout(8000);
  rec("search api", apiStatus === 200 && apiBody.length > 40,
      apiStatus ? `HTTP ${apiStatus} body=${apiBody.slice(0, 60)}` : "koi api call nahi dikhi");
  await p.close();
} catch (e: any) { rec("search api", false, String(e?.message ?? e)); }

// 6) captcha / bot wall laga?
try {
  const p = await ctx.newPage();
  await p.goto("https://www.tiktok.com/tag/fyp", { waitUntil: "domcontentloaded", timeout: 60_000 });
  await p.waitForTimeout(4000);
  const body = (await p.content()).toLowerCase();
  const wall = ["captcha", "verify to continue", "unusual traffic", "access denied"].filter((w) => body.includes(w));
  rec("bot wall", wall.length === 0, wall.length ? `mila: ${wall.join(", ")}` : "koi captcha/wall nahi");
  await p.close();
} catch (e: any) { rec("bot wall", false, String(e?.message ?? e)); }

await browser.close();

const passed = results.filter((r) => r.ok).length;
console.log(`\n  ${passed}/${results.length} pass`);
console.log(results.every((r) => r.ok)
  ? "  → poora tiktok scrape ho sakta hai, Creative Center ki zaroorat nahi"
  : "  → upar dekho kaunsa hissa ruka");
