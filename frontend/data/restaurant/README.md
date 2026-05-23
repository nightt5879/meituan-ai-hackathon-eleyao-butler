# Restaurant Data MVP

This folder contains the Guangzhou University Town restaurant data layer MVP for backend and future OpenClaw integration.

## Files

- `regions/guangzhou_university_town.json`: region center, radius, validation radius, and future 20km expansion settings.
- `shops.gut.seed.json`: 30 reviewed manual sample shops for Guangzhou University Town.
- `dishes.gut.seed.json`: generated-from-hints dishes linked by `shopId`.
- `shop-features.gut.seed.json`: generated-from-hints shop features for filtering and ranking.
- `data-source-meta.json`: source kind definitions and source batch metadata.
- `import/shops.manual.template.csv`: recommended simplified Chinese CSV template for manual collection.
- `import/shops.manual.gut-2026-05-23.csv`: source CSV for the current 30-shop manual collection batch.
- `import/shops.template.csv`: advanced full-field CSV template for draft imports.

## Source Rules

Every shop, dish, feature, and region must include `source` and `sourceId`.

- `manual_sample`: manually organized shop sample data. Current formal shops use this source and come from the reviewed manual CSV batch.
- `generated_from_hints`: generated dishes or shop features derived from manual shop category, tags, and representative dish hints. It is not a real menu or verified store environment.
- `generated`: synthetic data created for development only. The current formal seed no longer contains old generated example shops.
- `manual_public_curated`: future manually curated public POI data with source links and collected time.
- `amap_poi_draft`: draft data from Amap API, requiring manual review.
- `tencent_poi_draft`: draft data from Tencent LBS API, requiring manual review.

Current formal seed status:

- 30 shops, all `source: "manual_sample"`.
- 150 dishes, all `source: "generated_from_hints"`.
- 30 shop-feature records, all `source: "generated_from_hints"`.

The shop base fields come from manual CSV organization. Dishes and features are generated from category and representative dish hints, and must not be presented as real menus, live prices, live queue risk, or verified environment facts. This project has not connected to real Meituan, Dianping, Amap, Tencent LBS, or other production POI APIs yet.

## CSV Import

Recommended path: copy `frontend/data/restaurant/import/shops.manual.template.csv` for each new batch, then fill the copied CSV. The current reviewed batch is stored as `frontend/data/restaurant/import/shops.manual.gut-2026-05-23.csv`. The simplified Chinese CSV uses this header:

```text
店名,类别,人均,地址,纬度,经度,代表菜
```

Field meanings:

- `店名`: Required. Reviewed shop name.
- `类别`: Required. Recommended values are 粤菜、川湘菜、火锅、烧烤、日料、韩餐、西餐、东北菜、新疆菜、家常菜、潮汕菜、粉面、快餐、奶茶、轻食、咖啡、甜品、其他.
- `人均`: Optional. Estimated per-person price in CNY.
- `地址`: Optional for draft, but recommended. Review it before merging into formal seed.
- `纬度`: Required. Latitude, usually around `23.x` near Guangzhou University Town.
- `经度`: Required. Longitude, usually around `113.x`. Do not swap latitude and longitude.
- `代表菜`: Optional. Use English semicolons (`;`) for multiple dishes, for example `叉烧饭;例汤套餐`. The importer stores this as `importHints.dishHints` so later generated dishes can prefer these names.

Human collection should focus on real shop name, category, address, coordinates, and per-person price. Tags, dishes, and features are prepared later by Codex or a follow-up script. Generated dishes and generated features must use `source: "generated_from_hints"` when they are derived from CSV category or representative dish hints, and must not pretend to be real menus.

The importer automatically fills:

- `id`: `gut_manual_001`, `gut_manual_002`, ...
- `regionId`: `guangzhou_university_town`
- `source`: `manual_sample`
- `sourceId`: `manual_gut_001`, `manual_gut_002`, ...
- `collectedAt`: today's date
- `confidence`: `0.65`
- `dishSeedMode`: `generated_by_category`
- `cuisines`: inferred from `类别`
- `tags`: Chinese tags inferred from `类别` and `代表菜`
- `featureTags`: program tags inferred from `类别`
- `avgPrice`: parsed from `人均`
- `notes`: `人工地图整理，菜品后续按类别生成补全`

Run the importer against the copied batch file. If you intentionally edit `shops.manual.template.csv` directly, you can omit `--input`, but the recommended flow is to keep the template as a template:

```powershell
node frontend/scripts/import-restaurant-csv.mjs --input=frontend/data/restaurant/import/shops.manual.gut-2026-05-23.csv
```

The importer writes:

```text
frontend/data/restaurant/import/shops.imported.draft.json
```

It never overwrites `shops.gut.seed.json`. Review the draft, verify `source` and `sourceId`, then manually merge selected entries.

Suggested batch flow:

1. Copy `shops.manual.template.csv` to a dated batch file, such as `shops.manual.gut-2026-05-23.csv`.
2. Run the importer and review `shops.imported.draft.json`.
3. Check duplicate shops, category consistency, coordinates, warning messages, source links, and source IDs.
4. Manually merge approved shops into `shops.gut.seed.json`.
5. Add 5-10 dishes per approved shop to `dishes.gut.seed.json`, using `generated_from_hints` when generated from category or representative dish hints.
6. Add one feature record per approved shop to `shop-features.gut.seed.json`, using `generated_from_hints` for inferred features.
7. Run `node frontend/scripts/validate-restaurant-data.mjs`.
8. Repeat another 10-shop batch until the dataset reaches 30-50 shops.

## Manual CSV Guide

Advanced path: use `frontend/data/restaurant/import/shops.template.csv` when you want to control every formal/draft field yourself. Run it with:

```powershell
node frontend/scripts/import-restaurant-csv.mjs --input=frontend/data/restaurant/import/shops.template.csv
```

The advanced header is:

```text
id,name,category,cuisines,avgPrice,rating,address,latitude,longitude,regionId,source,sourceId,sourceUrl,collectedAt,confidence,tags,featureTags,dishSeedMode,notes
```

Field meanings:

- `id`: Stable shop id, for example `gut_real_noodle_001`. Must be unique.
- `name`: Shop name. Use the reviewed public POI name.
- `category`: Primary category used by search and ranking, such as `粤菜`, `川湘菜`, `火锅`, `烧烤`, `日料`, `韩餐`, `西餐`, `东北菜`, `新疆菜`, `家常菜`, `潮汕菜`, `粉面`, `快餐`, `奶茶`, or `轻食`.
- `cuisines`: More detailed cuisine labels. Use semicolons for multiple values.
- `avgPrice`: Estimated per-person price in CNY. Leave blank if unknown.
- `rating`: Public rating if the source is reliable. Leave blank if unknown.
- `address`: Reviewed address text.
- `latitude`: Latitude, usually around `23.x` for Guangzhou University Town.
- `longitude`: Longitude, usually around `113.x`. Do not swap latitude and longitude.
- `regionId`: Use `guangzhou_university_town` for the current region.
- `source`: For shops, use one of `manual_public_curated`, `manual_sample`, `amap_poi_draft`, or `tencent_poi_draft`. Use `generated` only for pure development mocks, and use `generated_from_hints` only for generated dishes/features.
- `sourceId`: Source batch id declared in `data-source-meta.json`, or a new batch id to add before merging.
- `sourceUrl`: Public source URL when available. Strongly recommended for `manual_public_curated`.
- `collectedAt`: Collection date in `YYYY-MM-DD`.
- `confidence`: Numeric confidence from `0` to `1`.
- `tags`: Shop tags for filtering. Use semicolons for multiple values.
- `featureTags`: Hints for later `shop-features.gut.seed.json`. Use semicolons.
- `dishSeedMode`: How dishes should be prepared later, such as `manual_menu`, `generated_by_category`, or `needs_manual_review`.
- `notes`: Human review notes. Do not store phone numbers, review text, or private data.

Fields that must be real/reviewed before a row can become formal shop seed: `name`, `category`, `address`, `latitude`, `longitude`, `regionId`, `source`, `sourceId`, `collectedAt`, and `confidence`.

Fields that may be estimated when clearly marked by source and notes: `avgPrice`, `rating`, `tags`, `featureTags`, and `dishSeedMode`. Generated dishes and generated features must use `source: "generated_from_hints"` when created from shop category or representative dish hints; do not inherit a real shop source for generated menu/details.

Manual workflow:

1. Fill or paste rows into `shops.template.csv`.
2. Keep multi-value fields separated by semicolons, not commas.
3. Run `node frontend/scripts/import-restaurant-csv.mjs`.
4. Review `frontend/data/restaurant/import/shops.imported.draft.json`.
5. Add any new `sourceId` batch to `data-source-meta.json`.
6. Manually merge approved shop fields into `shops.gut.seed.json`.
7. Add 5-10 dishes per shop to `dishes.gut.seed.json`.
8. Add one feature record per shop to `shop-features.gut.seed.json`.
9. Run `node frontend/scripts/validate-restaurant-data.mjs`.

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

These scripts are samples only in the current MVP. The seed has not been populated from live Meituan/Dianping data or a production map API ingestion pipeline.

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
Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/restaurants/search -ContentType 'application/json' -Body '{"keyword":"粉面","limit":3}'
```

Get shop detail:

```powershell
Invoke-RestMethod http://localhost:3000/api/restaurants/gut_manual_014
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
