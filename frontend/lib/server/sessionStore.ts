import { createHash, randomBytes, randomUUID, timingSafeEqual } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { withFileLock } from "@/lib/server/fileLock";

const SESSION_TOKEN_PREFIX = "sess_";
const DEFAULT_SESSION_TTL_DAYS = 30;
const LAST_SEEN_WRITE_INTERVAL_MS = 60_000;

export type AuthenticatedUser = {
  userId: string;
  identityType: "wechat_openid";
  isStable: true;
};

type UserRecord = {
  user_id: string;
  openid_hash: string;
  identity_type: "wechat_openid";
  created_at: string;
  updated_at: string;
  last_seen_at: string;
};

type SessionRecord = {
  token_hash: string;
  user_id: string;
  created_at: string;
  expires_at: string;
  last_seen_at: string;
};

type SessionDatabase = {
  version: 1;
  users: Record<string, UserRecord>;
  sessions: Record<string, SessionRecord>;
};

let operationQueue: Promise<unknown> = Promise.resolve();

function getStateFilePath() {
  const configured = process.env.MEITUAN_AUTH_STATE_FILE?.trim();

  if (configured) {
    return path.isAbsolute(configured) ? configured : path.resolve(/*turbopackIgnore: true*/ process.cwd(), configured);
  }

  return path.join(/*turbopackIgnore: true*/ process.cwd(), ".data", "wechat-auth-sessions.json");
}

function nowIso() {
  return new Date().toISOString();
}

function hashValue(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function createUserId(openid: string) {
  return `user_${hashValue(openid).slice(0, 24)}`;
}

function createSessionToken() {
  return `${SESSION_TOKEN_PREFIX}${randomBytes(32).toString("base64url")}`;
}

function createExpiryIso() {
  const ttlDays = Number(process.env.MEITUAN_AUTH_SESSION_TTL_DAYS || DEFAULT_SESSION_TTL_DAYS);
  const safeTtlDays = Number.isFinite(ttlDays) && ttlDays > 0 ? ttlDays : DEFAULT_SESSION_TTL_DAYS;
  return new Date(Date.now() + safeTtlDays * 24 * 60 * 60 * 1000).toISOString();
}

function safeEquals(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

async function writeDatabase(database: SessionDatabase) {
  const filePath = getStateFilePath();
  const directory = path.dirname(filePath);
  const tempPath = path.join(directory, `.tmp-${path.basename(filePath)}-${process.pid}-${Date.now()}-${randomUUID()}`);

  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(tempPath, `${JSON.stringify(database, null, 2)}\n`, "utf8");
  await fs.rename(tempPath, filePath);
}

async function readDatabase(): Promise<SessionDatabase> {
  const filePath = getStateFilePath();

  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as SessionDatabase;

    if (!parsed.users || !parsed.sessions || parsed.version !== 1) {
      throw new Error("Unsupported auth session store format.");
    }

    return parsed;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }

    const database: SessionDatabase = {
      version: 1,
      users: {},
      sessions: {}
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

function toAuthenticatedUser(record: UserRecord): AuthenticatedUser {
  return {
    userId: record.user_id,
    identityType: record.identity_type,
    isStable: true
  };
}

export async function createWechatSession(openid: string) {
  const normalizedOpenid = openid.trim();

  if (!normalizedOpenid) {
    throw new Error("Wechat openid is required.");
  }

  return enqueueWrite(async () => {
    const database = await readDatabase();
    const timestamp = nowIso();
    const userId = createUserId(normalizedOpenid);
    const existingUser = database.users[userId];
    const userRecord: UserRecord = {
      user_id: userId,
      openid_hash: hashValue(normalizedOpenid),
      identity_type: "wechat_openid",
      created_at: existingUser?.created_at ?? timestamp,
      updated_at: timestamp,
      last_seen_at: timestamp
    };
    const sessionToken = createSessionToken();
    const tokenHash = hashValue(sessionToken);

    database.users[userId] = userRecord;
    database.sessions[tokenHash] = {
      token_hash: tokenHash,
      user_id: userId,
      created_at: timestamp,
      expires_at: createExpiryIso(),
      last_seen_at: timestamp
    };

    await writeDatabase(database);

    return {
      user: toAuthenticatedUser(userRecord),
      sessionToken
    };
  });
}

export function extractBearerToken(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);

  if (match) {
    return match[1].trim();
  }

  return request.headers.get("x-session-token")?.trim() || "";
}

export async function getCurrentUserFromRequest(request: Request): Promise<AuthenticatedUser | null> {
  const token = extractBearerToken(request);

  if (!token) {
    return null;
  }

  const tokenHash = hashValue(token);

  return enqueueWrite(async () => {
    const database = await readDatabase();
    const session = database.sessions[tokenHash];

    if (!session || !safeEquals(session.token_hash, tokenHash)) {
      return null;
    }

    if (new Date(session.expires_at).getTime() <= Date.now()) {
      delete database.sessions[tokenHash];
      await writeDatabase(database);
      return null;
    }

    const user = database.users[session.user_id];

    if (!user) {
      delete database.sessions[tokenHash];
      await writeDatabase(database);
      return null;
    }

    const now = Date.now();
    const lastSeenAt = Math.max(
      new Date(session.last_seen_at).getTime() || 0,
      new Date(user.last_seen_at).getTime() || 0
    );

    if (lastSeenAt > 0 && now - lastSeenAt < LAST_SEEN_WRITE_INTERVAL_MS) {
      return toAuthenticatedUser(user);
    }

    const timestamp = new Date(now).toISOString();
    session.last_seen_at = timestamp;
    user.last_seen_at = timestamp;
    user.updated_at = timestamp;
    await writeDatabase(database);

    return toAuthenticatedUser(user);
  });
}
