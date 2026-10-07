import type { FeaturedAlbum, FeaturedAlbumConfig, FeaturedAlbumConfigInput } from '@/app/features/featured/models/featured.models';
import { apiFetch } from '@/lib/api-client';

export class FeaturedService {
    async getFeatured(): Promise<FeaturedAlbum> {
        return apiFetch<FeaturedAlbum>('/api/featured');
    }

    async getConfig(): Promise<FeaturedAlbumConfig> {
        return apiFetch<FeaturedAlbumConfig>('/api/admin/featured');
    }

    async updateConfig({ persons, ...rest }: FeaturedAlbumConfigInput): Promise<FeaturedAlbumConfig> {
        return apiFetch<FeaturedAlbumConfig>('/api/admin/featured', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...rest, personIds: persons.map((p) => p.id) }),
        });
    }
}
