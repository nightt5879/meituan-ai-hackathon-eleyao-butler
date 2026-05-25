import { promises as fs } from "fs";
import path from "path";
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

function weekendDataDir() {
  return path.join(/* turbopackIgnore: true */ process.cwd(), "data", "weekend");
}

async function readJsonFile<T>(filePath: string): Promise<T> {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw) as T;
}

export async function loadWeekendData(options: { fresh?: boolean } = {}): Promise<WeekendDataSet> {
  if (cachedData && !options.fresh) {
    return cachedData;
  }

  const baseDir = weekendDataDir();
  const [regionsFile, poisFile, templatesFile, sourceMeta] = await Promise.all([
    readJsonFile<WeekendRegionsFile>(path.join(baseDir, "weekend-area-regions.json")),
    readJsonFile<WeekendPoisFile>(path.join(baseDir, "weekend-pois.seed.json")),
    readJsonFile<WeekendRouteTemplatesFile>(path.join(baseDir, "weekend-route-templates.seed.json")),
    readJsonFile<WeekendDataSourceMetaFile>(path.join(baseDir, "data-source-meta.json"))
  ]);

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
