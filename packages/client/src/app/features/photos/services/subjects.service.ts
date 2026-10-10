import type { AdminPerson } from '@/app/features/admin/models/person.models';
import { apiFetch } from '@/lib/api-client';
import type { PhotoSubject, SubjectSuggestion } from '../models/subjects.models';

export class SubjectsService {
    async getPhotoSubjects(photoId: string): Promise<PhotoSubject[]> {
        return apiFetch<PhotoSubject[]>(`/api/photos/${encodeURIComponent(photoId)}/subjects`);
    }

    async getSubjectSuggestions(photoId: string): Promise<SubjectSuggestion[]> {
        return apiFetch<SubjectSuggestion[]>(`/api/photos/${encodeURIComponent(photoId)}/subject-suggestions`);
    }

    async addSubject(personId: string, photoId: string): Promise<PhotoSubject> {
        return apiFetch<PhotoSubject>(`/api/photos/${encodeURIComponent(photoId)}/subjects`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ personId }),
        });
    }

    async removeSubject(personId: string, photoId: string): Promise<void> {
        await apiFetch<void>(`/api/photos/${encodeURIComponent(photoId)}/subjects/${encodeURIComponent(personId)}`, {
            method: 'DELETE',
        });
    }

    /** Suggest a person not yet in the index. Returns the existing person if the name already matches one. */
    async proposePerson(fullName: string): Promise<AdminPerson> {
        return apiFetch<AdminPerson>('/api/persons/proposals', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fullName }),
        });
    }

    async searchPersons(q: string): Promise<AdminPerson[]> {
        return apiFetch<AdminPerson[]>(`/api/persons?q=${encodeURIComponent(q)}`);
    }

    async setPortrait(personId: string, photoId: string | null): Promise<AdminPerson> {
        return apiFetch<AdminPerson>(`/api/admin/persons/${encodeURIComponent(personId)}/portrait`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ photoId }),
        });
    }
}
