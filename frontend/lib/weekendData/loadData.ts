import regionsJson from "../../data/weekend/weekend-area-regions.json";
import poisJson from "../../data/weekend/weekend-pois.seed.json";
import templatesJson from "../../data/weekend/weekend-route-templates.seed.json";
import sourceMetaJson from "../../data/weekend/data-source-meta.json";
import type {
  WeekendDataSet,
  WeekendDataSourceMetaFile,
  WeekendPoi,
  WeekendRegion,
  WeekendRouteTemplate
} from "./types";

type WeekendRegionsFile = {
  regions: WeekendRegion[];
};

type WeekendPoisFile = {
  pois: WeekendPoi[];
};

type WeekendRouteTemplatesFile = {
  templates: WeekendRouteTemplate[];
};

let cachedData: WeekendDataSet | null = null;

export async function loadWeekendData(options: { fresh?: boolean } = {}): Promise<WeekendDataSet> {
  if (cachedData && !options.fresh) {
    return cachedData;
  }

  const regionsFile = regionsJson as WeekendRegionsFile;
  const poisFile = poisJson as WeekendPoisFile;
  const templatesFile = templatesJson as WeekendRouteTemplatesFile;
  const sourceMeta = sourceMetaJson as WeekendDataSourceMetaFile;

  const regions = regionsFile.regions ?? [];
  const areas = regions.flatMap((region) => region.areas ?? []);
  const pois = poisFile.pois ?? [];
  const routeTemplates = templatesFile.templates ?? [];

  cachedData = {
    regions,
    areas,
    pois,
    routeTemplates,
    sourceMeta,
    areasById: new Map(areas.map((area) => [area.id, area])),
    poisById: new Map(pois.map((poi) => [poi.id, poi])),
    routeTemplatesById: new Map(routeTemplates.map((template) => [template.id, template]))
  };

  return cachedData;
}
