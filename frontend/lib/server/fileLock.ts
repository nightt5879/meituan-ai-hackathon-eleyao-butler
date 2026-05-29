import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";

const DEFAULT_LOCK_TIMEOUT_MS = 10_000;
const DEFAULT_STALE_LOCK_MS = 60_000;
const RETRY_DELAY_MS = 40;

function numberFromEnv(name: string, fallback: number) {
  const raw = Number(process.env[name]);
  return Number.isFinite(raw) && raw > 0 ? raw : fallback;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function removeStaleLock(lockPath: string, staleMs: number) {
  try {
    const stat = await fs.stat(lockPath);
    if (Date.now() - stat.mtimeMs <= staleMs) {
      return false;
    }

    await fs.unlink(lockPath);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return true;
    }
    throw error;
  }
}

export async function withFileLock<T>(targetPath: string, operation: () => Promise<T>): Promise<T> {
  if (process.env.MEITUAN_DISABLE_FILE_LOCK === "1") {
    return operation();
  }

  const lockPath = `${targetPath}.lock`;
  const owner = `${process.pid}:${Date.now()}:${randomUUID()}`;
  const timeoutMs = numberFromEnv("MEITUAN_FILE_LOCK_TIMEOUT_MS", DEFAULT_LOCK_TIMEOUT_MS);
  const staleMs = numberFromEnv("MEITUAN_FILE_LOCK_STALE_MS", DEFAULT_STALE_LOCK_MS);
  const startedAt = Date.now();
  let lockHandle: fs.FileHandle | null = null;

  await fs.mkdir(path.dirname(targetPath), { recursive: true });

  while (!lockHandle) {
    try {
      lockHandle = await fs.open(lockPath, "wx");
      await lockHandle.writeFile(owner, "utf8");
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
        throw error;
      }

      await removeStaleLock(lockPath, staleMs);

      if (Date.now() - startedAt > timeoutMs) {
        throw new Error(`Timed out waiting for file lock: ${lockPath}`);
      }

      await sleep(RETRY_DELAY_MS);
    }
  }

  try {
    return await operation();
  } finally {
    await lockHandle.close();

    try {
      const currentOwner = await fs.readFile(lockPath, "utf8");
      if (currentOwner === owner) {
        await fs.unlink(lockPath);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
  }
}
