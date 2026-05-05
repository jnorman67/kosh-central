import { ApiError } from '@/lib/api-client';
import { ScanText } from 'lucide-react';
import { useOcrQueries } from '../contexts/ocr-query.context';

interface OcrPanelProps {
    bundleId: string;
    isAdmin: boolean;
    className?: string;
}

export function OcrPanel({ bundleId, isAdmin, className }: OcrPanelProps) {
    const { useGetOcr, useRunOcr } = useOcrQueries();
    const { data, isLoading, error } = useGetOcr(bundleId);
    const runOcr = useRunOcr();

    const notFound = error instanceof ApiError && error.status === 404;
    const hasResult = !!data;

    if (!hasResult && !isAdmin && (notFound || !isLoading)) return null;

    return (
        <div className={`flex max-h-48 flex-col ${className ?? ''}`}>
            <div className="flex shrink-0 items-center justify-between gap-2 px-4 py-2.5">
                <span className="text-sm font-semibold text-amber-900">Text in photo</span>
                {isAdmin && (
                    <button
                        type="button"
                        disabled={runOcr.isPending}
                        onClick={() => runOcr.mutate(bundleId)}
                        className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-50"
                    >
                        <ScanText className="h-3.5 w-3.5" />
                        {runOcr.isPending ? 'Running…' : hasResult ? 'Re-run OCR' : 'Run OCR'}
                    </button>
                )}
            </div>

            <div className="min-h-0 overflow-y-auto">
                {isLoading && <p className="px-4 pb-3 text-xs text-muted-foreground">Loading…</p>}

                {runOcr.isPending && (
                    <p className="px-4 pb-3 text-xs text-muted-foreground">Analysing image…</p>
                )}

                {!isLoading && !runOcr.isPending && hasResult && (
                    <div className="px-4 pb-3">
                        <p className="whitespace-pre-wrap text-sm text-amber-950">{data.text}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                            via OCR · {new Date(data.ranAt + 'Z').toLocaleDateString()}
                        </p>
                    </div>
                )}

                {!isLoading && !runOcr.isPending && !hasResult && notFound && isAdmin && (
                    <p className="px-4 pb-3 text-xs text-muted-foreground">No OCR result yet.</p>
                )}

                {runOcr.isError && (
                    <p className="px-4 pb-3 text-xs text-red-600">OCR failed — please try again.</p>
                )}
            </div>
        </div>
    );
}
