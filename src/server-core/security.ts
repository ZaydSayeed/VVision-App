import { Request, Response, NextFunction } from "express";
import { config } from "./config";

// In-memory token cache to avoid hitting Supabase on every request
const userCache = new Map<string, string>();

export interface AuthInfo {
  userId: string;
  token: string;
}

// Extend Express Request to include auth info
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

  // Check cache first
  const cachedUserId = userCache.get(token);
  if (cachedUserId) {
    req.auth = { userId: cachedUserId, token };
    next();
    return;
  }

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

    // Cache this mapping
    userCache.set(token, userId);
    if (userCache.size > 1000) userCache.clear();

    req.auth = { userId, token };
    next();
  } catch {
    res.status(401).json({ detail: "Could not validate token" });
  }
}
