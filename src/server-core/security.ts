import { Request, Response, NextFunction } from "express";
import { config } from "./config";

interface CachedToken {
  userId: string;
  expiresAt: number;
}

// In-memory token cache — 5 min TTL so revoked tokens expire promptly
const userCache = new Map<string, CachedToken>();
const CACHE_TTL_MS = 5 * 60 * 1000;

export interface AuthInfo {
  userId: string;
  token: string;
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthInfo;
    }
  }
}

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ detail: "Missing authorization header" });
    return;
  }

  const token = authHeader.slice(7);

  // Check cache
  const cached = userCache.get(token);
  if (cached && cached.expiresAt > Date.now()) {
    req.auth = { userId: cached.userId, token };
    next();
    return;
  }

  // Stale or missing — remove and re-validate
  userCache.delete(token);

  try {
    const response = await fetch(`${config.supabaseUrl}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: config.supabaseAnonKey,
      },
    });

    if (response.status !== 200) {
      res.status(401).json({ detail: "Invalid or expired token" });
      return;
    }

    const userData = (await response.json()) as { id?: string };
    const userId = userData.id;
    if (!userId) {
      res.status(401).json({ detail: "Invalid token" });
      return;
    }

    userCache.set(token, { userId, expiresAt: Date.now() + CACHE_TTL_MS });
    // Evict oldest entries if cache is getting large
    if (userCache.size > 1000) {
      const now = Date.now();
      for (const [k, v] of userCache) {
        if (v.expiresAt < now) userCache.delete(k);
      }
    }

    req.auth = { userId, token };
    next();
  } catch {
    res.status(401).json({ detail: "Could not validate token" });
  }
}
