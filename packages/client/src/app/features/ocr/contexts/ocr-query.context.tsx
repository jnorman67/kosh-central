import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { createOcrQueries, type OcrQueries } from '../queries/ocr.queries';
import { OcrService } from '../services/ocr.service';

const OcrQueryContext = createContext<OcrQueries | undefined>(undefined);

export function OcrQueryProvider({ children }: { children: ReactNode }) {
    const service = useMemo(() => new OcrService(), []);
    const queries = useMemo(() => createOcrQueries(service), [service]);
    return <OcrQueryContext.Provider value={queries}>{children}</OcrQueryContext.Provider>;
}

export function useOcrQueries() {
    const ctx = useContext(OcrQueryContext);
    if (!ctx) throw new Error('useOcrQueries must be used within OcrQueryProvider');
    return ctx;
}
