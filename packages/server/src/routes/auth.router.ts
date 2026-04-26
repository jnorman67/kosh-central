import bcrypt from "bcryptjs";
import { Router } from "express";
import jwt from "jsonwebtoken";
import {
    type AuthPayload,
    getJwtSecret,
    requireAuth,
} from "../auth/auth.middleware.js";
import {
    createUser,
    findUserByEmail,
    findUserById,
    listUsers,
    updateUserPasswordHash,
} from "../auth/users.store.js";
import { findInvite } from "../config/invites.config.js";

const TOKEN_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

export function createAuthRouter(): Router {
    const router = Router();

    router.post("/register", async (req, res) => {
        try {
            const { email, displayName, password } = req.body;

            if (!email || !displayName || !password) {
                res.status(400).json({
                    error: "Email, display name, and password are required",
                });
                return;
            }

            if (password.length < 8) {
                res.status(400).json({
                    error: "Password must be at least 8 characters",
                });
                return;
            }

            const invite = findInvite(email);
            if (!invite) {
                res.status(403).json({
                    error: "This email is not on the invite list",
                });
                return;
            }

            if (findUserByEmail(email)) {
                res.status(409).json({
                    error: "An account with this email already exists",
                });
                return;
            }

            const passwordHash = await bcrypt.hash(password, 12);
            const id = crypto.randomUUID();

            createUser({
                id,
                email: invite.email, // use canonical casing from invite list
                displayName: displayName.trim(),
                passwordHash,
                role: invite.role,
                createdAt: new Date().toISOString(),
            });

            res.status(201).json({
                message: "Account created. Please log in.",
            });
        } catch (err) {
            console.error("POST /register error:", err);
            res.status(500).json({ error: "Internal server error" });
        }
    });

    router.post("/login", async (req, res) => {
        try {
            const { email, password } = req.body;

            if (!email || !password) {
                res.status(400).json({
                    error: "Email and password are required",
                });
                return;
            }

            const user = findUserByEmail(email);
            if (!user) {
                res.status(401).json({ error: "Invalid email or password" });
                return;
            }

            const valid = await bcrypt.compare(password, user.passwordHash);
            if (!valid) {
                res.status(401).json({ error: "Invalid email or password" });
                return;
            }

            const payload: AuthPayload = {
                userId: user.id,
                email: user.email,
                role: user.role,
            };
            const token = jwt.sign(payload, getJwtSecret(), {
                expiresIn: "7d",
            });

            res.cookie("token", token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "lax",
                maxAge: TOKEN_MAX_AGE,
            });

            res.json({
                user: {
                    id: user.id,
                    email: user.email,
                    displayName: user.displayName,
                    role: user.role,
                },
            });
        } catch (err) {
            console.error("POST /login error:", err);
            res.status(500).json({ error: "Internal server error" });
        }
    });

    router.post("/logout", (_req, res) => {
        res.clearCookie("token");
        res.json({ message: "Logged out" });
    });

    router.post("/change-password", requireAuth, async (req, res) => {
        try {
            const { currentPassword, newPassword } = req.body;

            if (!currentPassword || !newPassword) {
                res.status(400).json({
                    error: "Current and new passwords are required",
                });
                return;
            }

            if (newPassword.length < 8) {
                res.status(400).json({
                    error: "New password must be at least 8 characters",
                });
                return;
            }

            const user = findUserById(req.user!.userId);
            if (!user) {
                res.status(401).json({ error: "User not found" });
                return;
            }

            const valid = await bcrypt.compare(
                currentPassword,
                user.passwordHash,
            );
            if (!valid) {
                res.status(401).json({
                    error: "Current password is incorrect",
                });
                return;
            }

            const newHash = await bcrypt.hash(newPassword, 12);
            updateUserPasswordHash(user.id, newHash);

            const payload: AuthPayload = {
                userId: user.id,
                email: user.email,
                role: user.role,
            };
            const token = jwt.sign(payload, getJwtSecret(), {
                expiresIn: "7d",
            });

            res.cookie("token", token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "lax",
                maxAge: TOKEN_MAX_AGE,
            });

            res.json({ message: "Password updated" });
        } catch (err) {
            console.error("POST /change-password error:", err);
            res.status(500).json({ error: "Internal server error" });
        }
    });

    router.get("/users", requireAuth, (_req, res) => {
        res.json(listUsers());
    });

    router.get("/me", requireAuth, (req, res) => {
        const user = findUserById(req.user!.userId);
        if (!user) {
            res.clearCookie("token");
            res.status(401).json({ error: "User not found" });
            return;
        }

        res.json({
            user: {
                id: user.id,
                email: user.email,
                displayName: user.displayName,
                role: user.role,
            },
        });
    });

    return router;
}
