import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { OcrService } from '../services/ocr.service';

const ocrKey = (bundleId: string) => ['Ocr', bundleId] as const;

export const createOcrQueries = (service: OcrService) => {
    const useGetOcr = (bundleId: string | null | undefined) =>
        useQuery({
            queryKey: ocrKey(bundleId!),
            queryFn: () => service.getOcr(bundleId!),
            enabled: !!bundleId,
            staleTime: Infinity,
            retry: false,
        });

    const useRunOcr = () => {
        const qc = useQueryClient();
        return useMutation({
            mutationFn: (bundleId: string) => service.runOcr(bundleId),
            onSuccess: (data) => {
                qc.setQueryData(ocrKey(data.bundleId), data);
            },
        });
    };

    return { useGetOcr, useRunOcr };
};

export type OcrQueries = ReturnType<typeof createOcrQueries>;
