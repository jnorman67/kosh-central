import { apiFetch } from '@/lib/api-client';

export interface OcrResult {
    id: string;
    bundleId: string;
    text: string;
    ranAt: string;
}

export class OcrService {
    async getOcr(bundleId: string): Promise<OcrResult> {
        return apiFetch<OcrResult>(`/api/ocr/${bundleId}`);
    }

    async runOcr(bundleId: string): Promise<OcrResult> {
        return apiFetch<OcrResult>(`/api/admin/ocr/${bundleId}`, { method: 'POST' });
    }
}
