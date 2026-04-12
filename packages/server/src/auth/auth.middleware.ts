import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import type { Role } from '../config/invites.config.js';

export interface AuthPayload {
    userId: string;
    email: string;
    role: Role;
}

declare module 'express-serve-static-core' {
    interface Request {
        user?: AuthPayload;
    }
}

export function getJwtSecret(): string {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        console.error('JWT_SECRET environment variable is required.');
        process.exit(1);
    }
    return secret;
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
    const token = req.cookies?.token;
    if (!token) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
    }

    try {
        const payload = jwt.verify(token, getJwtSecret()) as AuthPayload;
        req.user = payload;
        next();
    } catch {
        res.status(401).json({ error: 'Invalid or expired token' });
    }
}
