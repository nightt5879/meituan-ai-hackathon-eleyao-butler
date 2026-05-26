# Weekend Planning Data MVP

This folder contains the first standalone data layer for the 周末轻规划 flow. It is designed for later integration with `frontend/lib/server/weekendPlanner.ts` and the mini-program weekend page, but this folder does not implement an API or UI.

## Files

- `weekend-area-regions.json`: MVP area scope for Guangzhou University Town, school nearby areas, center lake, riverside greenway, science center, Lingnan Impression Garden, Bio Island, and Beigang Wetland.
- `weekend-pois.seed.json`: synthetic POI/activity nodes used by route matching. The current MVP keeps this under 80 records.
- `weekend-route-templates.seed.json`: route templates for outdoor, balanced, and rainy/low-energy backup routes.
- `data-source-meta.json`: source kind and source batch definitions.
- `data-source-notes.md`: provenance, trust boundary, and replacement path.

## Data Boundary

All current records use `source: "synthetic_weekend_mvp"` and `synthetic: true`.

The data is mock/synthetic planning data. It is not a production travel guide, not real Meituan/Dianping content, not a real map route plan, and not a claim about live opening hours, ticketing, queues, ratings, sales, or user reviews.

The current seed also includes commercial-area and village-life synthetic nodes for student weekend scenarios: GOGO 新天地, 贝岗村, 北亭村, 南亭村, 创智园, 青创汇, 穗石村, and several校内商业/休息 anchors. These records cover indoor entertainment, friend gatherings, coffee/tea, desserts, light meals, mall walking, and study/chat stops. They are virtual planning nodes only and do not represent real brands, real merchants, real business hours, real queues, or real venue availability.

## POI Fields

Each POI includes:

- `id`: stable unique id.
- `name`: display name for planning output.
- `type`: coarse activity type, such as `cafe`, `park_walk`, `gallery`, `museum`, `cinema`, `arcade`, `board_game`, `mystery_game`, `tea`, or `indoor_activity`.
- `area`: area id declared in `weekend-area-regions.json`.
- `addressText`: human-readable approximate location.
- `latitude` / `longitude`: MVP coordinate for matching and future map handoff.
- `indoor`: whether the node is primarily indoors.
- `cost`: estimated per-person cost in CNY for planning math.
- `durationMinutes`: default stay duration.
- `walkingIntensity`: `low`, `medium`, or `high`.
- `tags`: interest and scene tags for matching.
- `routeNodeRoles`: route-slot roles such as `cafe_start`, `main_activity`, `indoor_backup`, `dessert_end`, or `return_buffer`.
- `suitableWeather`: supported weather labels: `sunny`, `cloudy`, `rainy`, `hot`, `unknown`.
- `suitableEnergy`: supported energy labels: `low`, `medium`, `high`.
- `riskTips`: synthetic planning risks that can feed route output.
- `source`, `sourceId`, `synthetic`, `confidence`, `notes`: provenance and trust metadata.

## Route Template Fields

Each template includes:

- `id`, `title`, `mode`: unique id, display title, and route mode.
- `slots`: semantic stops with `poiFilters` and `fallbackPoiIds`.
- `estimatedDurationMinutes`, `estimatedBudget`: rough template-level planning defaults.
- `transportNote`: non-map movement note.
- `routeReason`, `fallbackReason`: explanation copy for backend/frontend display.
- `inviteCopyTemplate`: template for shareable invite text.
- `checkTemplates`: required checks for budget, time window, weather, walking intensity, and return time.
- `riskTipTemplates`: template-level risks.
- `source`, `sourceId`, `synthetic`, `confidence`: provenance.

## Add A POI

1. Add one record to `weekend-pois.seed.json`.
2. Use an existing `area` id from `weekend-area-regions.json`.
3. Keep generated or inferred details marked as `synthetic: true`.
4. Add enough `tags`, `routeNodeRoles`, `suitableWeather`, and `suitableEnergy` for templates to match it.
5. Run validation.

## Add A Route Template

1. Add one record to `weekend-route-templates.seed.json`.
2. Choose `mode`: `outdoor`, `balanced`, or `indoor_backup`.
3. Prefer `slots` with broad filters and explicit `fallbackPoiIds`.
4. Include all five `checkTemplates`.
5. Ensure validation can render non-empty `timeline`, `checks`, `riskTips`, and `inviteCopy`.

## Validation

Run from the repo root:

```powershell
node frontend/scripts/validate-weekend-data.mjs
```

Then run the frontend build:

```powershell
cd frontend
npm.cmd run build
```

## Future API Integration

A later #26 integration can replace the inline `mockPlaces` and route assembly in `frontend/lib/server/weekendPlanner.ts` with:

```ts
import { matchWeekendRoutes } from "@/lib/weekendData/matchService";
```

The returned route matches already include `timeline`, `checks`, `riskTips`, `inviteCopy`, `routeReason`, and `fallbackReason`. The API can map these to the current response fields while keeping the existing Open-Meteo weather behavior.
