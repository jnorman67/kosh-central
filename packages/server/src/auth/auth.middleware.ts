import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { findUserById, type Role } from './users.store.js';

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

    let payload: AuthPayload;
    try {
        payload = jwt.verify(token, getJwtSecret()) as AuthPayload;
    } catch {
        res.status(401).json({ error: 'Invalid or expired token' });
        return;
    }

    // Re-read the user so role changes and revoked access apply immediately, not when the JWT expires.
    const user = findUserById(payload.userId);
    if (!user || user.disabledAt) {
        res.clearCookie('token');
        res.status(401).json({ error: user ? 'This account has been disabled' : 'User not found' });
        return;
    }
    req.user = { userId: user.id, email: user.email, role: user.role };
    next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
    if (req.user?.role !== 'admin') {
        res.status(403).json({ error: 'Admin access required' });
        return;
    }
    next();
}
