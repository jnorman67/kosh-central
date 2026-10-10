import { Router } from 'express';
import { requireAdmin } from '../auth/auth.middleware.js';
import { createInvite, deleteInvite, findInvite, listInvites, updateInviteRole } from '../auth/invites.store.js';
import {
    findUserByEmail,
    findUserById,
    isRole,
    listUsersForAdmin,
    ROLES,
    setUserDisabled,
    toAdminUser,
    updateUserProfile,
    updateUserRole,
} from '../auth/users.store.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLE_ERROR = `role must be one of: ${ROLES.join(', ')}`;

export function createUsersAdminRouter(): Router {
    const router = Router();
    router.use(requireAdmin);

    router.get('/', (_req, res) => {
        res.json({ users: listUsersForAdmin(), invites: listInvites() });
    });

    router.post('/invites', (req, res) => {
        const email = typeof req.body?.email === 'string' ? req.body.email.trim() : '';
        const role = req.body?.role;

        if (!EMAIL_PATTERN.test(email)) {
            res.status(400).json({ error: 'Enter a valid email address', field: 'email' });
            return;
        }
        if (!isRole(role)) {
            res.status(400).json({ error: ROLE_ERROR, field: 'role' });
            return;
        }
        if (findUserByEmail(email)) {
            res.status(409).json({ error: 'Someone with this email already has an account', field: 'email' });
            return;
        }
        if (findInvite(email)) {
            res.status(409).json({ error: 'This email has already been invited', field: 'email' });
            return;
        }

        res.status(201).json(createInvite(email, role, req.user!.userId));
    });

    router.patch('/invites/:email', (req, res) => {
        if (!isRole(req.body?.role)) {
            res.status(400).json({ error: ROLE_ERROR, field: 'role' });
            return;
        }
        const invite = updateInviteRole(req.params.email, req.body.role);
        if (!invite) {
            res.status(404).json({ error: 'Invite not found' });
            return;
        }
        res.json(invite);
    });

    router.delete('/invites/:email', (req, res) => {
        if (!deleteInvite(req.params.email)) {
            res.status(404).json({ error: 'Invite not found' });
            return;
        }
        res.status(204).end();
    });

    router.patch('/:id', (req, res) => {
        const { role, disabled } = req.body ?? {};
        const displayName = typeof req.body?.displayName === 'string' ? req.body.displayName.trim() : req.body?.displayName;
        const email = typeof req.body?.email === 'string' ? req.body.email.trim() : req.body?.email;

        if (displayName !== undefined && (typeof displayName !== 'string' || displayName === '')) {
            res.status(400).json({ error: 'Name is required', field: 'displayName' });
            return;
        }
        if (email !== undefined && (typeof email !== 'string' || !EMAIL_PATTERN.test(email))) {
            res.status(400).json({ error: 'Enter a valid email address', field: 'email' });
            return;
        }
        if (role !== undefined && !isRole(role)) {
            res.status(400).json({ error: ROLE_ERROR, field: 'role' });
            return;
        }
        if (disabled !== undefined && typeof disabled !== 'boolean') {
            res.status(400).json({ error: 'disabled must be true or false', field: 'disabled' });
            return;
        }

        const user = findUserById(req.params.id);
        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }
        // Blocking self-changes also guarantees at least one active admin remains (the caller).
        if (user.id === req.user!.userId && ((role !== undefined && role !== user.role) || disabled === true)) {
            res.status(400).json({ error: "You can't change your own role or disable your own account" });
            return;
        }
        if (email !== undefined) {
            // Emails are unique case-insensitively, so a case-only change to this user's own address is fine.
            const owner = findUserByEmail(email);
            if (owner && owner.id !== user.id) {
                res.status(409).json({ error: 'Someone else already has an account with this email', field: 'email' });
                return;
            }
            // Taking an invited address would leave that invite unusable, since registration rejects existing emails.
            if (findInvite(email)) {
                res.status(409).json({ error: 'This email has a pending invite. Remove the invite first.', field: 'email' });
                return;
            }
        }

        updateUserProfile(user.id, { displayName, email });
        if (role !== undefined) updateUserRole(user.id, role);
        if (disabled !== undefined) setUserDisabled(user.id, disabled);
        res.json(toAdminUser(findUserById(user.id)!));
    });

    return router;
}
