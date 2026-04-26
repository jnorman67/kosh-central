import type { AdminPerson, PersonInput, PersonRelationship } from '@/app/features/admin/models/person.models';
import { apiFetch } from '@/lib/api-client';

export class AdminPersonsService {
    async list(): Promise<AdminPerson[]> {
        return apiFetch<AdminPerson[]>('/api/persons');
    }

    async search(q: string): Promise<AdminPerson[]> {
        return apiFetch<AdminPerson[]>(`/api/persons?q=${encodeURIComponent(q)}`);
    }

    async getRelationships(personId: string): Promise<PersonRelationship[]> {
        return apiFetch<PersonRelationship[]>(`/api/persons/${encodeURIComponent(personId)}/relationships`);
    }

    async create(input: PersonInput): Promise<AdminPerson> {
        return apiFetch<AdminPerson>('/api/admin/persons', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(input),
        });
    }

    async update(id: string, input: PersonInput): Promise<AdminPerson> {
        return apiFetch<AdminPerson>(`/api/admin/persons/${encodeURIComponent(id)}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(input),
        });
    }

    async remove(id: string): Promise<void> {
        await apiFetch<void>(`/api/admin/persons/${encodeURIComponent(id)}`, { method: 'DELETE' });
    }
}
