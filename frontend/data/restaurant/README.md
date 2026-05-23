# Restaurant Data MVP

This folder contains the Guangzhou University Town restaurant data layer MVP for backend and future OpenClaw integration.

## Files

- `regions/guangzhou_university_town.json`: region center, radius, validation radius, and future 20km expansion settings.
- `shops.gut.seed.json`: small seed shop list.
- `dishes.gut.seed.json`: seed dishes linked by `shopId`.
- `shop-features.gut.seed.json`: derived shop features for filtering and ranking.
- `data-source-meta.json`: source kind definitions and source batch metadata.
- `import/shops.template.csv`: manual CSV template for draft imports.

## Source Rules

Every shop, dish, feature, and region must include `source` and `sourceId`.

- `generated`: synthetic data created for development only. It is not real POI data.
- `manual_sample`: manually maintained sample/config data. Unless a public source is recorded, treat it as sample data.
- `manual_public_curated`: future manually curated public POI data with source links and collected time.
- `amap_poi_draft`: draft data from Amap API, requiring manual review.
- `tencent_poi_draft`: draft data from Tencent LBS API, requiring manual review.

Current seed data is framework test data. Do not present it as a complete or verified real restaurant dataset.

## CSV Import

Edit `import/shops.template.csv` manually with public or internally reviewed POI fields:

```powershell
node frontend/scripts/import-restaurant-csv.mjs
```

The importer writes:

```text
frontend/data/restaurant/import/shops.imported.draft.json
```

It never overwrites `shops.gut.seed.json`. Review the draft, verify `source` and `sourceId`, then manually merge selected entries.

## POI API Drafts

Sample scripts are provided for future API use:

```powershell
Copy-Item frontend/scripts/import-amap-poi.mjs.sample frontend/scripts/import-amap-poi.local.mjs
$env:AMAP_WEB_SERVICE_KEY="your-key"
node frontend/scripts/import-amap-poi.local.mjs

Copy-Item frontend/scripts/import-tencent-poi.mjs.sample frontend/scripts/import-tencent-poi.local.mjs
$env:TENCENT_LBS_KEY="your-key"
node frontend/scripts/import-tencent-poi.local.mjs
```

Both scripts output draft JSON files under `frontend/data/restaurant/import/` and do not modify seed files.

## Validation

Run:

```powershell
node frontend/scripts/validate-restaurant-data.mjs
```

The validator checks required fields, references, source metadata, dish counts, and whether shop coordinates fall within the Guangzhou University Town validation radius.

## API Examples

After starting the Next.js app:

```powershell
cd frontend
npm.cmd run dev
```

Search shops:

```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/restaurants/search -ContentType 'application/json' -Body '{"keyword":"示例","limit":3}'
```

Get shop detail:

```powershell
Invoke-RestMethod http://localhost:3000/api/restaurants/gut_seed_east_gate_noodle
```

Search dishes:

```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/restaurants/dishes/search -ContentType 'application/json' -Body '{"keyword":"饭","limit":5}'
```

Rank shops:

```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/restaurants/rank -ContentType 'application/json' -Body '{"slots":{"budgetMax":50,"tasteTags":["清淡"],"needTags":["适合聊天"]},"userMemory":{},"limit":3}'
```

## 20km Expansion

The region file includes `futureExpansion.maxRadiusKm = 20`. When expanding beyond the current core area, keep separate source batches and consider splitting region tags for nearby areas such as Panyu Wanbo, Pazhou, Kecun, and Shiqiao.
