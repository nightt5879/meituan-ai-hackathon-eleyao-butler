# Restaurant Data Source Notes

## Current Seed

The current Guangzhou University Town seed contains 30 shops, 150 dishes, and 30 shop-feature records.

- Shops use `source: "manual_sample"`. Their base fields come from the reviewed manual CSV collection, including shop name, category, average price, address, latitude, and longitude.
- Dishes use `source: "generated_from_hints"`. They are generated from the shop category and representative dish hints in the manual CSV.
- Shop features use `source: "generated_from_hints"`. They are generated from shop category, tags, and dish hints for search and ranking tests.

This seed is not complete real POI data. Manual shop fields should still be treated as reviewed sample data unless a public source URL or formal POI source is added. Generated dishes, prices, quiet scores, queue risk, and environment features must not be shown as verified facts or real menus. The current MVP has not connected to live Meituan, Dianping, Amap, Tencent LBS, or other production POI APIs.

## Trust Levels

- `manual_sample`: manually organized shop sample data. Good for MVP testing, but not a fully verified restaurant dataset.
- `generated_from_hints`: generated dish or feature data derived from manual category and representative dish hints. Use only for development and recommendation-service integration tests.
- `generated`: pure synthetic/mock data. It is retained as a source kind for future development-only data, but the current formal seed no longer contains generated example shops.
- `manual_public_curated`: future human-reviewed public information. Must include source links and collection time.
- `amap_poi_draft` / `tencent_poi_draft`: API draft data. Must be reviewed before merging.

## Sensitive Data Boundary

Do not collect or store review text, phone numbers, merchant contact details, private user content, login-only data, CAPTCHA-protected data, or anti-crawler bypass output.

## Replacement Path

1. Import candidate shops with CSV or a POI sample script.
2. Review generated draft files under `import/`.
3. Remove duplicates and verify coordinates, source, and category.
4. Merge approved shops into `shops.gut.seed.json`.
5. Generate or curate dishes and features with explicit source labels. Use `generated_from_hints` for category/hint-based completion, and use a higher-trust source only when menu or feature data is actually reviewed.
6. Run `node frontend/scripts/validate-restaurant-data.mjs`.

## CSV Curation Notes

The manual CSV is for shop POI collection only. It does not prove real menu items, live prices, queue risk, or store environment.

For real or semi-real shop expansion, use `manual_public_curated` only when the shop name, address, coordinates, source URL or source note, collection date, and confidence have been reviewed. Use draft sources for raw map API output, and use `generated_from_hints` for generated dish/menu/feature completion.

Do not commit `*.draft.json` import outputs. They are review artifacts and should remain ignored by Git.

## Future Updates

For a production-like layer, move from seed JSON to a database or indexed data service. Keep `source`, `sourceId`, `collectedAt`, and trust notes available in API responses so downstream recommendation logic can reason about data reliability.
