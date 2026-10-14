import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { findUserById, type Role } from './users.store.js';

export interface AuthPayload {
    userId: string;
    email: string;
    role: Role;
}

/**
 * Sessions last 90 days from the last visit: requireAuth re-issues the cookie once a day. That's
 * safe to keep long because every request re-reads the user, so revoking access is immediate.
 */
const SESSION_DAYS = 90;
const SESSION_MAX_AGE_MS = SESSION_DAYS * 24 * 60 * 60 * 1000;
const SESSION_REFRESH_AFTER_S = 24 * 60 * 60;

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

/** Sign the user in: set (or renew) the session cookie. */
export function startSession(res: Response, user: { id: string; email: string; role: Role }): void {
    const payload: AuthPayload = { userId: user.id, email: user.email, role: user.role };
    const token = jwt.sign(payload, getJwtSecret(), { expiresIn: `${SESSION_DAYS}d` });
    res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: SESSION_MAX_AGE_MS,
    });
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
    const token = req.cookies?.token;
    if (!token) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
    }

    let payload: AuthPayload & { iat?: number };
    try {
        payload = jwt.verify(token, getJwtSecret()) as AuthPayload & { iat?: number };
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
    if (!payload.iat || Date.now() / 1000 - payload.iat > SESSION_REFRESH_AFTER_S) startSession(res, user);
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
