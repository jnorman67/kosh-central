import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Role } from '../config/invites.config.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const USERS_PATH = path.join(__dirname, '../../.users.json');

export interface StoredUser {
    id: string;
    email: string;
    displayName: string;
    passwordHash: string;
    role: Role;
    createdAt: string;
}

function readUsers(): StoredUser[] {
    try {
        if (fs.existsSync(USERS_PATH)) {
            return JSON.parse(fs.readFileSync(USERS_PATH, 'utf-8'));
        }
    } catch {
        // Corrupt file — start fresh
    }
    return [];
}

function writeUsers(users: StoredUser[]): void {
    fs.writeFileSync(USERS_PATH, JSON.stringify(users, null, 2), 'utf-8');
}

export function findUserByEmail(email: string): StoredUser | undefined {
    return readUsers().find((u) => u.email.toLowerCase() === email.toLowerCase());
}

export function findUserById(id: string): StoredUser | undefined {
    return readUsers().find((u) => u.id === id);
}

export function createUser(user: StoredUser): void {
    const users = readUsers();
    users.push(user);
    writeUsers(users);
}
