import { createHash, randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { withFileLock } from "@/lib/server/fileLock";

export type UserProfile = {
  profileId: string;
  userId: string;
  initialized: boolean;
  initializedAt: string | null;
  butler: {
    name: string;
    mode: "basic";
    version: string;
  };
  preferences: {
    food: {
      avoidTags: string[];
      spicyLevel: string;
      budget: string;
      distance: string;
    };
    permissions: Record<string, boolean>;
  };
  memories: {
    foodPreferenceRecords: unknown[];
    favoriteShopIds: string[];
  };
  createdAt: string;
  updatedAt: string;
};

type ProfileDatabase = {
  version: 1;
  profiles: Record<string, UserProfile>;
};

let operationQueue: Promise<unknown> = Promise.resolve();

function getStateFilePath() {
  const configured = process.env.MEITUAN_USER_PROFILE_STATE_FILE?.trim();

  if (configured) {
    return path.isAbsolute(configured) ? configured : path.resolve(/*turbopackIgnore: true*/ process.cwd(), configured);
  }

  return path.join(/*turbopackIgnore: true*/ process.cwd(), ".data", "user-profiles.json");
}

function nowIso() {
  return new Date().toISOString();
}

function hashValue(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function createProfileId(userId: string) {
  return `profile_${hashValue(userId).slice(0, 24)}`;
}

function createDefaultProfile(userId: string): UserProfile {
  const timestamp = nowIso();

  return {
    profileId: createProfileId(userId),
    userId,
    initialized: false,
    initializedAt: null,
    butler: {
      name: "饿了幺 AI 管家",
      mode: "basic",
      version: "profile-shell-v1"
    },
    preferences: {
      food: {
        avoidTags: [],
        spicyLevel: "",
        budget: "",
        distance: ""
      },
      permissions: {
        stableFoodMemory: true,
        behaviorLearning: true,
        recommendationHistory: true,
        weekendPlans: true
      }
    },
    memories: {
      foodPreferenceRecords: [],
      favoriteShopIds: []
    },
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

async function writeDatabase(database: ProfileDatabase) {
  const filePath = getStateFilePath();
  const directory = path.dirname(filePath);
  const tempPath = path.join(directory, `.tmp-${path.basename(filePath)}-${process.pid}-${Date.now()}-${randomUUID()}`);

  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(tempPath, `${JSON.stringify(database, null, 2)}\n`, "utf8");
  await fs.rename(tempPath, filePath);
}

async function readDatabase(): Promise<ProfileDatabase> {
  const filePath = getStateFilePath();

  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as ProfileDatabase;

    if (!parsed.profiles || parsed.version !== 1) {
      throw new Error("Unsupported user profile store format.");
    }

    return parsed;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }

    const database: ProfileDatabase = {
      version: 1,
      profiles: {}
    };
    await writeDatabase(database);
    return database;
  }
}

function enqueueWrite<T>(operation: () => Promise<T>) {
  const run = () => withFileLock(getStateFilePath(), operation);
  const next = operationQueue.then(run, run);
  operationQueue = next.catch(() => undefined);
  return next;
}

export async function ensureUserProfile(userId: string) {
  const normalizedUserId = userId.trim();

  if (!normalizedUserId) {
    throw new Error("User id is required.");
  }

  return enqueueWrite(async () => {
    const database = await readDatabase();
    const profileId = createProfileId(normalizedUserId);
    const existing = database.profiles[profileId];

    if (existing) {
      existing.updatedAt = nowIso();
      await writeDatabase(database);
      return existing;
    }

    const profile = createDefaultProfile(normalizedUserId);
    database.profiles[profile.profileId] = profile;
    await writeDatabase(database);
    return profile;
  });
}

export async function initializeUserProfile(userId: string) {
  return enqueueWrite(async () => {
    const database = await readDatabase();
    const profileId = createProfileId(userId);
    const profile = database.profiles[profileId] || createDefaultProfile(userId);
    const timestamp = nowIso();

    if (!profile.initialized) {
      profile.initialized = true;
      profile.initializedAt = timestamp;
    }

    profile.updatedAt = timestamp;
    database.profiles[profile.profileId] = profile;
    await writeDatabase(database);
    return profile;
  });
}
