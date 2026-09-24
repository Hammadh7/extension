# tiktok-trend-radar

TikTok Creative Center se trending hashtags aur sounds roz scrape karta hai.

## Ye repo public kyun hai

TikTok India me 2020 se blocked hai. Laptop se `www.tiktok.com` kholne par wo
`/about` par redirect kar deta hai. Isliye scraping **GitHub Actions ke US runner**
par hoti hai, jahan ye block hai hi nahi.

Public repo par Actions ke minutes unlimited hain, private par 2,000/month. Isi
wajah se repo public hai.

⚠️ Public hone ka matlab: is repo me **koi cookie, token ya API key commit mat
karna**. Wo sab GitHub Secrets me jaane chahiye.

## Signed headers ka masla

Creative Center ka androoni API (`ads.tiktok.com/creative_radar_api/...`) teen
headers maangta hai jo page ka apna JavaScript sign karta hai:

    anonymous-user-id, timestamp, user-sign

Sirf cookies bhejne par `code: 40101 "no permission"` aata hai (test kiya hua).

Isliye hum wo signing dobara nahi likhte. Playwright se asli browser chalta hai,
page khud apne liye API call karta hai, aur hum uske **responses intercept** kar
lete hain. Fayda: TikTok jab signing algorithm badalta hai, hamara code nahi
tootta.

## Chalana

```bash
npm install
npx playwright install chromium

# default US, 7 din
npm run scrape

# doosra country / window
COUNTRY=GB PERIOD=30 npm run scrape

# browser dekhte hue (debug)
HEADLESS=false npm run scrape
```

India se bhi chal jaata hai, kyunki Creative Center yahan blocked nahi hai.
Sirf `www.tiktok.com` ke asli videos ke liye US runner chahiye.

## Output

`data/<date>-<country>-<period>d.json` aur wahi `.csv`.

Trend detect karne ke liye kaam ke columns:

| column | kyun |
|---|---|
| `rank_diff` | rank kitna upar-neeche hua — yahi asli growth signal hai |
| `is_new` | pehli baar list me aaya |
| `video_count` | kitne videos ne use kiya |

## Schedule

`.github/workflows/tiktok-trends.yml` roz 06:00 UTC (11:30 IST) par chalti hai.
Manual chalane ke liye Actions tab me "Run workflow".

Natija do jagah jaata hai: `data/` me commit, aur run ka artifact (30 din).

## Seemaayein

- Creative Center sirf **naam aur rank** deta hai. "Kaunsa video format trend kar
  raha hai" ye nahi batata. Uske liye us sound/hashtag ke asli videos chahiye,
  phir unka structural description, phir clustering.
- Bulk video scraping datacenter IP par block hoti hai. GitHub runners bhi
  datacenter hain. Us paimane par residential proxies chahiye honge.
- TikTok scraping unki terms of service ke khilaf hai.
