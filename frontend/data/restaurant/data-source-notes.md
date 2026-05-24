# Restaurant Data Source Notes

## Current Seed

The current Guangzhou University Town seed contains two physically separated layers that are merged by the restaurant data service:

- Shops use `source: "manual_sample"`. Their base fields come from the reviewed manual CSV collection, including shop name, category, average price, address, latitude, and longitude.
- Dishes use `source: "generated_from_hints"`. They are generated from the shop category and representative dish hints in the manual CSV.
- Shop features use `source: "generated_from_hints"`. They are generated from shop category, tags, and dish hints for search and ranking tests.
- Synthetic MVP shops, dishes, shop features, and scene-fit records use `source: "synthetic_mvp"`, `synthetic: true`, and numeric `confidence`. They are generated from Guangzhou University Town spatial scaffolds and virtual shop profiles.

This seed is not complete real POI data. Manual shop fields should still be treated as reviewed sample data unless a public source URL or formal POI source is added. Generated dishes, prices, quiet scores, queue risk, and environment features must not be shown as verified facts or real menus. The current MVP has not connected to live Meituan, Dianping, Amap, Tencent LBS, or other production POI APIs.

Synthetic MVP data uses real Guangzhou University Town area constraints, but every shop name, dish, budget, queue-risk label, noise label, scene score, and explanation is virtual. Coordinates are synthetic candidate points inside a business-district polygon, near a campus anchor, or around a manual sample coordinate with jitter. They do not represent real merchants, real menus, real ratings, real sales, live queues, real user reviews, or platform-certified data.

## Trust Levels

- `manual_sample`: manually organized shop sample data. Good for MVP testing, but not a fully verified restaurant dataset.
- `generated_from_hints`: generated dish or feature data derived from manual category and representative dish hints. Use only for development and recommendation-service integration tests.
- `synthetic_mvp`: virtual restaurant database MVP data. It is useful for ranking, explanation, and scene-fit tests for solo meals, group meetups, and weekend planning, but must remain visibly marked as synthetic.
- `generated`: pure synthetic/mock data. It is retained as a source kind for future development-only data, but the current formal seed no longer contains generated example shops.
- `manual_public_curated`: future human-reviewed public information. Must include source links and collection time.
- `amap_poi_draft` / `tencent_poi_draft`: API draft data. Must be reviewed before merging.

## Sensitive Data Boundary

Do not collect or store review text, phone numbers, merchant contact details, private user content, login-only data, CAPTCHA-protected data, or anti-crawler bypass output.

## Replacement Path

1. Keep synthetic data in `*.synthetic.seed.json` while it is used for recommendation coverage.
2. Import candidate real shops with CSV or a reviewed POI pipeline.
3. Review generated draft files under `import/`.
4. Remove duplicates and verify coordinates, source, category, and provenance.
5. Merge approved real shops into a non-synthetic seed with a reviewed source.
6. Generate or curate dishes and features with explicit source labels. Use `generated_from_hints` for category/hint-based completion, and use a higher-trust source only when menu or feature data is actually reviewed.
7. Replace or down-rank synthetic shops by source instead of relabeling them as real.
8. Run `node frontend/scripts/validate-restaurant-data.mjs`.

## Scene Fit Notes

`scene-fit.synthetic.seed.json` gives each synthetic shop 0-100 scores for `soloToday`, `groupMeetup`, and `weekendPlan`.

- `soloToday` supports "今天吃什么" by combining budget, simulated queue risk, single-person fit, distance, and dietary tags.
- `groupMeetup` supports多人约饭 by combining group-friendly dishes, chat fit, simulated noise, per-person budget, and taste compatibility.
- `weekendPlan` supports周末规划 by combining stay comfort, coffee/dessert/light-meal nodes, rainy-day indoor fit, and route-node explanations.

Scene-fit hints are explanation material for synthetic recommendations only.

## CSV Curation Notes

The manual CSV is for shop POI collection only. It does not prove real menu items, live prices, queue risk, or store environment.

For real or semi-real shop expansion, use `manual_public_curated` only when the shop name, address, coordinates, source URL or source note, collection date, and confidence have been reviewed. Use draft sources for raw map API output, and use `generated_from_hints` for generated dish/menu/feature completion.

Do not commit `*.draft.json` import outputs. They are review artifacts and should remain ignored by Git.

## Future Updates

For a production-like layer, move from seed JSON to a database or indexed data service. Keep `source`, `sourceId`, `collectedAt`, and trust notes available in API responses so downstream recommendation logic can reason about data reliability.
