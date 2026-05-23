# Restaurant Data Source Notes

## Current Seed

The current Guangzhou University Town seed is intentionally small: 6 generated shops and 30 generated dishes. It exists to verify schemas, loaders, validation, search APIs, and simple ranking behavior.

The seed is not complete real POI data. Generated shop names, addresses, dishes, quiet scores, queue risk, and prices must not be shown as verified facts.

## Trust Levels

- `generated`: lowest trust. Use for local development only.
- `manual_sample`: sample/config data. Good for testing, not a verified restaurant dataset.
- `manual_public_curated`: future human-reviewed public information. Must include source links and collection time.
- `amap_poi_draft` / `tencent_poi_draft`: API draft data. Must be reviewed before merging.

## Sensitive Data Boundary

Do not collect or store review text, phone numbers, merchant contact details, private user content, login-only data, CAPTCHA-protected data, or anti-crawler bypass output.

## Replacement Path

1. Import candidate shops with CSV or a POI sample script.
2. Review generated draft files under `import/`.
3. Remove duplicates and verify coordinates, source, and category.
4. Merge approved shops into `shops.gut.seed.json`.
5. Add real or curated dishes only when source and confidence are clear.
6. Run `node frontend/scripts/validate-restaurant-data.mjs`.

## Future Updates

For a production-like layer, move from seed JSON to a database or indexed data service. Keep `source`, `sourceId`, `collectedAt`, and trust notes available in API responses so downstream recommendation logic can reason about data reliability.
