# Facebook test ad — API log

- Banaya: 2026-09-25 13:08 UTC
- Account: `act_4522342371386479` (naveen labs)
- App: `897513362771883` (Zumo)
- Status: **PAUSED** — koi delivery nahi, kharcha zero
- Daily budget set: ₹200 (paused hone se kharch nahi hoga)
- API version: v21.0

## Kya bana

| Object | ID |
|---|---|
| campaign_id | `52609222062455` |
| adset_id | `52609222065055` |
| creative_id | `29099392622999775` |
| creative_note | `maujooda creative reuse kiya (naya banane ki permission nahi)` |
| ad_id | `52609222585455` |

## Har API call

### 1. upload image

`POST https://graph.facebook.com/v21.0/act_4522342371386479/adimages`  → **HTTP 200** (653 ms)

Request params:

```json
{}
```

Response:

```json
{
  "images": {
    "source.png": {
      "hash": "7bf18eb86e07b663e9e57b020f4d9683",
      "height": 1080,
      "url": "https://scontent.fblr25-1.fna.fbcdn.net/v/t45.1600-4/824875809_28898506706433530_721294324714550976_n.png?stp=dst-jpg_tt6&_nc_cat=109&_nc_map=urlgen_bucketless&ccb=1-7&_nc_sid=d5bd00&_nc_ohc=cyqcnY-YQacQ7kNvwFtvApG&_nc_oc=AdpbN2fqGh_zQnr465wryKoXSD1qQ2WLcxAAlwNjV2LkgmsFs9CkZE6_UfaF4Q0tnY4&_nc_zt=1&_nc_ht=scontent.fblr25-1.fna&edm=AJNyvH4EAAAA&_nc_gid=7nHBR244Gkz4PQuw-0ZfOg&_nc_tpa=Q5bMBQLyoS0XpinDS12I5OKpDmERz2ydEjGEZlVFGr3C5XoXnGhW0mc48556wEcOfnN_TNjU7OSM-ljcLQ&oh=00_AQIUJexYNyx7Ceq3RcIQxI9VkrlyNO7R04voj7cMkx9Q0A&oe=6ABC5CAF",
      "name": "source.png",
      "url_128": "https://scontent.fblr25-1.fna.fbcdn.net/v/t45.1600-4/824875809_28898506706433530_721294324714550976_n.png?stp=dst-jpg_s168x128_tt6&_nc_cat=109&_nc_map=urlgen_bucketless&ccb=1-7&_nc_sid=d73f9c&_nc_ohc=cyqcnY-YQacQ7kNvwFtvApG&_nc_oc=AdpbN2fqGh_zQnr465wryKoXSD1qQ2WLcxAAlwNjV2LkgmsFs9CkZE6_UfaF4Q0tnY4&_nc_zt=1&_nc_ht=scontent.fblr25-1.fna&edm=AJNyvH4EAAAA&_nc_gid=7nHBR244Gkz4PQuw-0ZfOg&_nc_tpa=Q5bMBQJnvj9Lnx3wG7p-b79vjEb6xyOtAI9CK9jaMQ8NNzcmwNnsC29-4MQI0v1v2C7-S40ji5J66i0KAg&oh=00_AQL1Es9p6fxY6-0kUCyFuLFtRWGxU8MNgBEZ4KNSZECXbg&oe=6ABC5CAF",
      "width": 1080,
      "url_256": "https://scontent.fblr25-1.fna.fbcdn.net/v/t45.1600-4/824875809_28898506706433530_721294324714550976_n.png?stp=dst-jpg_s261x260_tt6&_nc_cat=109&_nc_map=urlgen_bucketless&ccb=1-7&_nc_sid=d73f9c&_nc_ohc=cyqcnY-YQacQ7kNvwFtvApG&_nc_oc=AdpbN2fqGh_zQnr465wryKoXSD1qQ2WLcxAAlwNjV2LkgmsFs9CkZE6_UfaF4Q0tnY4&_nc_zt=1&_nc_ht=scontent.fblr25-1.fna&edm=AJNyvH4EAAAA&_nc_gid=7nHBR244Gkz4PQuw-0ZfOg&_nc_tpa=Q5bMBQK9PSKM-LNH3gQXh3eQ08PSRbvswxbcRuXT2Gb-n_vVwZ95O1f_b0w6d7qL6EDaGNvvuOMQYYlwEA&oh=00_AQLgwoA2Uf3zVnXv7WgTaqJFemE3p-D8Zo
```

### 4. create creative

`POST https://graph.facebook.com/v21.0/act_4522342371386479/adcreatives`  → **HTTP 400** (863 ms)

Request params:

```json
{
  "name": "CLAUDE TEST 20260925-130832",
  "object_story_spec": "{\"page_id\": \"774003065792115\", \"link_data\": {\"link\": \"http://play.google.com/store/apps/details?id=com.zumo.android\", \"message\": \"Test creative \\u2014 Claude ne API se banaya (PAUSED).\", \"name\": \"Zumo\", \"image_hash\": \"7bf18eb86e07b663e9e57b020f4d9683\", \"call_to_action\": {\"type\": \"INSTALL_MOBILE_APP\", \"value\": {\"link\": \"http://play.google.com/store/apps/details?id=com.zumo.android\"}}}}"
}
```

Response:

```json
{
  "error": {
    "message": "Permissions error",
    "type": "OAuthException",
    "code": 200,
    "error_subcode": 1815199,
    "is_transient": false,
    "error_user_title": "Ad Account Has No Access To Instagram Account",
    "error_user_msg": "Ad account has no access to this Instagram account. Please use authorized Instagram account or assign ad account to this Instagram account first.",
    "fbtrace_id": "ACynwWaCjll8KNritKRkAs3"
  }
}
```

### 4b. reuse existing creative

`GET https://graph.facebook.com/v21.0/act_4522342371386479/adcreatives`  → **HTTP 200** (472 ms)

Request params:

```json
{
  "fields": "id,name",
  "limit": "1"
}
```

Response:

```json
{
  "data": [
    {
      "id": "29099392622999775",
      "name": "bhajan apni awaz 2026-09-24-05c0b5aefbefe7a55d9e5c6e0e1e796d"
    }
  ],
  "paging": {
    "cursors": {
      "before": "MjkwOTkzOTI2MjI5OTk3NzUZD",
      "after": "MjkwOTkzOTI2MjI5OTk3NzUZD"
    },
    "next": "https://graph.facebook.com/v24.0/act_4522342371386479/adcreatives?fields=id%2Cname&limit=1&access_token=<TOKEN>&after=MjkwOTkzOTI2MjI5OTk3NzUZD"
  }
}
```

### 5. create ad

`POST https://graph.facebook.com/v21.0/act_4522342371386479/ads`  → **HTTP 200** (3582 ms)

Request params:

```json
{
  "name": "CLAUDE TEST 20260925-130832",
  "adset_id": "52609222065055",
  "creative": "{\"creative_id\": \"29099392622999775\"}",
  "status": "PAUSED"
}
```

Response:

```json
{
  "id": "52609222585455"
}
```

### 6. verify ad

`GET https://graph.facebook.com/v21.0/52609222585455`  → **HTTP 200** (362 ms)

Request params:

```json
{
  "fields": "id,name,status,effective_status,adset_id,creative"
}
```

Response:

```json
{
  "id": "52609222585455",
  "name": "CLAUDE TEST 20260925-130832",
  "status": "PAUSED",
  "effective_status": "IN_PROCESS",
  "adset_id": "52609222065055",
  "creative": {
    "id": "29099392622999775"
  }
}
```

