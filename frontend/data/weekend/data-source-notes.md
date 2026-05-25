# Weekend Data Source Notes

## Current Seed

The current weekend planning seed is a synthetic MVP dataset built from the user-provided Guangzhou University Town anchors and the existing mock planner structure.

It contains:

- area definitions for the first-stage planning scope;
- synthetic POI/activity nodes for school nearby routes, center lake, riverside, Guangdong Science Center, Lingnan Impression Garden, Bio Island, and Beigang Wetland;
- synthetic POI/activity nodes for university-town commercial and village-life areas, including GOGO 新天地, 贝岗村, 北亭村, 南亭村, 创智园, 青创汇, 穗石村, and校内商业/休息 anchors;
- route templates for outdoor, balanced, and rainy/low-energy backup plans.

All records are marked with `source: "synthetic_weekend_mvp"` and `synthetic: true`.

## Trust Boundary

This data is not production POI data. It must not be presented as:

- real Meituan or Dianping data;
- live map route planning;
- verified opening hours;
- verified ticketing;
- live queues;
- real ratings, sales, or user reviews;
- a complete Guangzhou travel guide.

Commercial-area and village-life POI are also synthetic. Names such as coffee corners, tea stops, table-game rooms, story rooms, mall walks, and indoor entertainment points are virtual planning labels. They do not identify real brands, real merchants, real opening status, real seat availability, or real on-site conditions.

Coordinates are useful for approximate matching and future map handoff, but this layer does not calculate real walking, cycling, driving, or transit routes.

## Why This Layer Exists

The current weekend planner already needs route output with:

- `timeline`;
- `checks`;
- `riskTips`;
- `inviteCopy`;
- route explanations and fallback explanations.

Keeping POI and route template data in JSON makes the mock planning base easier to review, validate, and replace later without burying everything inside `weekendPlanner.ts`.

## Replacement Path

1. Keep synthetic records visibly separated and marked.
2. Add reviewed public POI data only after manual review or a future approved import pipeline.
3. Preserve `source`, `sourceId`, `synthetic`, `confidence`, and notes.
4. Replace synthetic POI batches gradually instead of relabeling them as real.
5. Keep route templates mostly reusable; swap only the POI pool and source metadata when higher-trust data arrives.

## Sensitive Data Boundary

Do not store private user content, phone numbers, review text, login-only data, scraped content, CAPTCHA-protected content, or merchant contact details in this seed.

## Validation

Use:

```powershell
node frontend/scripts/validate-weekend-data.mjs
```

The validator checks id uniqueness, source metadata, synthetic flags, area references, template matchability, route-mode coverage, renderability, and misleading platform wording.
