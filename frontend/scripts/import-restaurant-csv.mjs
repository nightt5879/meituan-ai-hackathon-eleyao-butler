import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(scriptDir, "..");
const importDir = path.join(frontendRoot, "data", "restaurant", "import");
const inputPath = path.join(importDir, "shops.template.csv");
const outputPath = path.join(importDir, "shops.imported.draft.json");

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      cell += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      row.push(cell);
      if (row.some((value) => value.trim() !== "")) {
        rows.push(row);
      }
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  row.push(cell);
  if (row.some((value) => value.trim() !== "")) {
    rows.push(row);
  }

  return rows;
}

function parseNumber(value, fieldName, rowIndex) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Row ${rowIndex} has invalid ${fieldName}: "${value}".`);
  }

  return parsed;
}

const raw = await fs.readFile(inputPath, "utf8");
const rows = parseCsv(raw);

if (rows.length < 2) {
  throw new Error(`No shop rows found in ${inputPath}.`);
}

const headers = rows[0].map((header) => header.trim());
const requiredHeaders = ["id", "name", "category", "address", "latitude", "longitude", "source", "sourceId"];
const missingHeaders = requiredHeaders.filter((header) => !headers.includes(header));

if (missingHeaders.length > 0) {
  throw new Error(`CSV is missing required headers: ${missingHeaders.join(", ")}.`);
}

const shops = rows.slice(1).map((row, rowOffset) => {
  const rowIndex = rowOffset + 2;
  const record = Object.fromEntries(headers.map((header, index) => [header, row[index]?.trim() ?? ""]));
  const missingFields = requiredHeaders.filter((field) => !record[field]);

  if (missingFields.length > 0) {
    throw new Error(`Row ${rowIndex} is missing required fields: ${missingFields.join(", ")}.`);
  }

  return {
    id: record.id,
    name: record.name,
    category: record.category,
    address: record.address,
    latitude: parseNumber(record.latitude, "latitude", rowIndex),
    longitude: parseNumber(record.longitude, "longitude", rowIndex),
    avgPrice: record.avgPrice ? parseNumber(record.avgPrice, "avgPrice", rowIndex) : null,
    rating: record.rating ? parseNumber(record.rating, "rating", rowIndex) : null,
    tags: record.tags ? record.tags.split(";").map((tag) => tag.trim()).filter(Boolean) : [],
    regionId: record.regionId || "guangzhou_university_town",
    source: record.source,
    sourceId: record.sourceId,
    updatedAt: new Date().toISOString().slice(0, 10)
  };
});

const draft = {
  schemaVersion: 1,
  importedAt: new Date().toISOString(),
  sourceFile: path.relative(frontendRoot, inputPath).replaceAll("\\", "/"),
  warning: "Draft only. Review manually before merging into shops.gut.seed.json.",
  shops
};

await fs.writeFile(outputPath, `${JSON.stringify(draft, null, 2)}\n`, "utf8");
console.log(`Imported ${shops.length} shops to ${outputPath}`);
