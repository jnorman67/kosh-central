import type { FolderInput, ImportResponse } from '@/app/features/admin/models/folder.models';
import { AdminFoldersService } from '@/app/features/admin/services/admin-folders.service';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { ApiError } from '@/lib/api-client';
import { useEffect, useState } from 'react';

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onImport: (folders: FolderInput[], mode: 'upsert' | 'replace') => Promise<ImportResponse>;
}

export function ImportDialog({ open, onOpenChange, onImport }: Props) {
    const [file, setFile] = useState<File | null>(null);
    const [parsed, setParsed] = useState<FolderInput[] | null>(null);
    const [mode, setMode] = useState<'upsert' | 'replace'>('upsert');
    const [parseError, setParseError] = useState<string | null>(null);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (!open) {
            setFile(null);
            setParsed(null);
            setMode('upsert');
            setParseError(null);
            setSubmitError(null);
            setSubmitting(false);
        }
    }, [open]);

    async function handleFile(f: File | null) {
        setFile(f);
        setParsed(null);
        setParseError(null);
        setSubmitError(null);
        if (!f) return;
        try {
            const text = await f.text();
            const folders = AdminFoldersService.parseImportFile(text);
            setParsed(folders);
        } catch (err) {
            setParseError(err instanceof Error ? err.message : String(err));
        }
    }

    async function handleSubmit() {
        if (!parsed) return;
        setSubmitting(true);
        setSubmitError(null);
        try {
            await onImport(parsed, mode);
            onOpenChange(false);
        } catch (err) {
            if (err instanceof ApiError) {
                setSubmitError(err.field ? `${err.field}: ${err.message}` : err.message);
            } else {
                setSubmitError(err instanceof Error ? err.message : String(err));
            }
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Import folders</DialogTitle>
                    <DialogDescription>Load a JSON file exported from this screen on another environment.</DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    <div className="space-y-1.5">
                        <Label htmlFor="file">JSON file</Label>
                        <input
                            id="file"
                            type="file"
                            accept="application/json,.json"
                            onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
                            className="block w-full text-sm file:mr-4 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-secondary-foreground hover:file:bg-secondary/80"
                        />
                        {file && parsed && (
                            <p className="text-xs text-muted-foreground">
                                Parsed {parsed.length} {parsed.length === 1 ? 'folder' : 'folders'} from {file.name}.
                            </p>
                        )}
                        {parseError && <p className="text-xs text-destructive">{parseError}</p>}
                    </div>

                    <div className="space-y-2">
                        <Label>Mode</Label>
                        <div className="space-y-2 text-sm">
                            <label className="flex items-start gap-2">
                                <input type="radio" className="mt-1" checked={mode === 'upsert'} onChange={() => setMode('upsert')} />
                                <span>
                                    <span className="font-medium">Upsert</span> — add new folders, update existing ones by slug. Folders not
                                    in the file are left untouched.
                                </span>
                            </label>
                            <label className="flex items-start gap-2">
                                <input type="radio" className="mt-1" checked={mode === 'replace'} onChange={() => setMode('replace')} />
                                <span>
                                    <span className="font-medium">Replace</span> — delete every folder not in the file, then insert the
                                    file's contents.
                                </span>
                            </label>
                        </div>
                    </div>

                    {submitError && <p className="text-sm text-destructive">{submitError}</p>}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
                        Cancel
                    </Button>
                    <Button onClick={handleSubmit} disabled={!parsed || submitting}>
                        {submitting ? 'Importing...' : 'Import'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
