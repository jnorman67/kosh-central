import type { FeaturedAlbum, FeaturedAlbumConfig, FeaturedAlbumConfigInput } from '@/app/features/featured/models/featured.models';
import { apiFetch } from '@/lib/api-client';

export class FeaturedService {
    async getFeatured(): Promise<FeaturedAlbum> {
        return apiFetch<FeaturedAlbum>('/api/featured');
    }

    async getConfig(): Promise<FeaturedAlbumConfig> {
        return apiFetch<FeaturedAlbumConfig>('/api/admin/featured');
    }

    async updateConfig(input: FeaturedAlbumConfigInput): Promise<FeaturedAlbumConfig> {
        return apiFetch<FeaturedAlbumConfig>('/api/admin/featured', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(input),
        });
    }
}
