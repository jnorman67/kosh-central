import bcrypt from "bcryptjs";
import { Router } from "express";
import { requireAuth, startSession } from "../auth/auth.middleware.js";
import { acceptInvite, findInvite } from "../auth/invites.store.js";
import { consumeLoginLink, findInviteLinkEmail } from "../auth/links.store.js";
import {
    findUserByEmail,
    findUserById,
    hasPassword,
    listUsers,
    type StoredUser,
    updateUserPasswordHash,
} from "../auth/users.store.js";

const LINK_INVALID =
    "This link has expired or has already been used. Ask for a new one.";

/** Phone keyboards often add a trailing space after an autocompleted address. */
function readEmail(value: unknown): string {
    return typeof value === "string" ? value.trim() : "";
}

function toAuthUser(user: StoredUser) {
    return {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        hasPassword: hasPassword(user),
    };
}

export function createAuthRouter(): Router {
    const router = Router();

    router.post("/register", async (req, res) => {
        try {
            const email = readEmail(req.body?.email);
            const { displayName, password } = req.body;

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

            // Registering consumes the invite, so check for an account first: someone who
            // already registered should be told to sign in, not that they aren't invited.
            if (findUserByEmail(email)) {
                res.status(409).json({
                    error: "You already have an account with this email. Sign in instead.",
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

            const passwordHash = await bcrypt.hash(password, 12);
            const id = crypto.randomUUID();

            acceptInvite({
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
            const email = readEmail(req.body?.email);
            const { password } = req.body;

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

            if (!hasPassword(user)) {
                res.status(401).json({
                    error: "This account doesn't have a password. Sign in with the link you were sent, or ask for a new one.",
                });
                return;
            }

            const valid = await bcrypt.compare(password, user.passwordHash);
            if (!valid) {
                res.status(401).json({ error: "Invalid email or password" });
                return;
            }

            if (user.disabledAt) {
                res.status(403).json({ error: "This account has been disabled" });
                return;
            }

            startSession(res, user);
            res.json({ user: toAuthUser(user) });
        } catch (err) {
            console.error("POST /login error:", err);
            res.status(500).json({ error: "Internal server error" });
        }
    });

    // One-time sign-in link. The page at /link/:token POSTs here, rather than the link hitting
    // the server directly, so link previews in messaging apps can't use the link up.
    router.post("/link", (req, res) => {
        const token = typeof req.body?.token === "string" ? req.body.token : "";
        const userId = token ? consumeLoginLink(token) : undefined;
        const user = userId ? findUserById(userId) : undefined;
        if (!user) {
            res.status(410).json({ error: LINK_INVALID });
            return;
        }
        if (user.disabledAt) {
            res.status(403).json({ error: "This account has been disabled" });
            return;
        }

        startSession(res, user);
        res.json({ user: toAuthUser(user) });
    });

    // Invite link: look up who it's for, so the join page can greet them.
    router.get("/join/:token", (req, res) => {
        const email = findInviteLinkEmail(req.params.token);
        if (!email) {
            res.status(410).json({ error: LINK_INVALID });
            return;
        }
        res.json({ email });
    });

    // Invite link: create the account (no password) and sign straight in.
    router.post("/join/:token", (req, res) => {
        const displayName =
            typeof req.body?.displayName === "string"
                ? req.body.displayName.trim()
                : "";
        if (!displayName) {
            res.status(400).json({ error: "Please enter your name" });
            return;
        }

        const email = findInviteLinkEmail(req.params.token);
        const invite = email ? findInvite(email) : undefined;
        if (!invite) {
            res.status(410).json({ error: LINK_INVALID });
            return;
        }

        const user: StoredUser = {
            id: crypto.randomUUID(),
            email: invite.email,
            displayName,
            passwordHash: "",
            role: invite.role,
            createdAt: new Date().toISOString(),
            disabledAt: null,
        };
        acceptInvite(user);

        startSession(res, user);
        res.status(201).json({ user: toAuthUser(user) });
    });

    router.post("/logout", (_req, res) => {
        res.clearCookie("token");
        res.json({ message: "Logged out" });
    });

    router.post("/change-password", requireAuth, async (req, res) => {
        try {
            const { currentPassword, newPassword } = req.body;

            if (!newPassword) {
                res.status(400).json({
                    error: "A new password is required",
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

            // Someone who joined by link has no password yet, so there's nothing to confirm.
            if (hasPassword(user)) {
                const valid =
                    typeof currentPassword === "string" &&
                    (await bcrypt.compare(currentPassword, user.passwordHash));
                if (!valid) {
                    res.status(401).json({
                        error: "Current password is incorrect",
                    });
                    return;
                }
            }

            const newHash = await bcrypt.hash(newPassword, 12);
            updateUserPasswordHash(user.id, newHash);

            startSession(res, user);
            res.json({
                message: hasPassword(user) ? "Password updated" : "Password set",
            });
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

        res.json({ user: toAuthUser(user) });
    });

    return router;
}
