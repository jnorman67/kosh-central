import { FileTypeIcon } from '@/app/features/photos/components/file-thumbnail';
import { usePhotosQueries } from '@/app/features/photos/contexts/photos-query.context';
import { fileContentUrl, fileKind, fileTypeLabel } from '@/app/features/photos/lib/files';
import type { Photo } from '@/app/features/photos/models/photos.models';
import { Button } from '@/components/ui/button';
import { Download, ExternalLink } from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';

interface FileViewerProps {
    file: Photo;
    /** The album the file lives in, which serves its bytes. */
    folderId: string;
    /** The file's anonymous OneDrive link, once fetched. Office files open there in the browser. */
    shareLink?: string;
}

/**
 * Shows a file that isn't a picture: a PDF in the browser's own viewer, text as text, video and
 * audio in players. Anything else, or anything the browser can't show, gets a card to open or
 * download it. Give it a `key` per file so a failed video doesn't stick to the next one.
 */
export function FileViewer({ file, folderId, shareLink }: FileViewerProps) {
    const [playbackFailed, setPlaybackFailed] = useState(false);
    const kind = fileKind(file);
    const url = fileContentUrl(folderId, file);

    // Phones (Android especially) can't show a PDF inside the page; they get the card instead.
    if (kind === 'pdf' && navigator.pdfViewerEnabled !== false) {
        return <iframe src={url} title={file.name} className="h-full w-full border-0 bg-zinc-800" />;
    }
    if (kind === 'text') {
        return <TextFileView url={url} />;
    }
    if (kind === 'video' && !playbackFailed) {
        return (
            <div className="flex h-full w-full items-center justify-center bg-black">
                <video
                    src={url}
                    poster={file.thumbnailUrl}
                    controls
                    playsInline
                    preload="metadata"
                    onError={() => setPlaybackFailed(true)}
                    className="max-h-full max-w-full"
                />
            </div>
        );
    }
    return (
        <FileCard
            file={file}
            folderId={folderId}
            shareLink={shareLink}
            note={playbackFailed ? 'This video can’t be played in the browser. Download it to watch.' : undefined}
        >
            {kind === 'audio' && <audio src={url} controls preload="metadata" className="w-full max-w-sm" />}
            {kind === 'pdf' && (
                <Button variant="secondary" size="sm" asChild>
                    <a href={url} target="_blank" rel="noreferrer">
                        <ExternalLink className="h-4 w-4" />
                        Open PDF
                    </a>
                </Button>
            )}
        </FileCard>
    );
}

function TextFileView({ url }: { url: string }) {
    const { useGetTextFile } = usePhotosQueries();
    const { data, isLoading, isError } = useGetTextFile(url);

    if (isLoading) {
        return (
            <div className="flex h-full items-center justify-center bg-black">
                <div className="h-10 w-10 animate-spin rounded-full border-2 border-zinc-700 border-t-zinc-200" />
            </div>
        );
    }
    if (isError || !data) {
        return <div className="flex h-full items-center justify-center bg-black text-zinc-500">This file couldn’t be loaded.</div>;
    }
    return (
        <div className="h-full overflow-auto bg-zinc-950">
            <pre className="mx-auto max-w-4xl whitespace-pre-wrap break-words p-4 font-mono text-sm leading-relaxed text-zinc-200 sm:p-8">
                {data.text}
            </pre>
            {data.truncated && (
                <p className="mx-auto max-w-4xl px-4 pb-8 text-sm text-zinc-500 sm:px-8">
                    Only the start of this file is shown. Download it to read the rest.
                </p>
            )}
        </div>
    );
}

interface FileCardProps extends FileViewerProps {
    note?: string;
    children?: ReactNode;
}

function FileCard({ file, folderId, shareLink, note, children }: FileCardProps) {
    return (
        <div className="flex h-full w-full items-center justify-center overflow-auto bg-black p-4">
            <div className="flex w-full max-w-md flex-col items-center gap-4 text-center">
                {file.thumbnailUrl ? (
                    <img src={file.thumbnailUrl} alt="" className="max-h-[40vh] max-w-full rounded-sm object-contain" />
                ) : (
                    <FileTypeIcon file={file} className="h-20 w-20 text-zinc-500" />
                )}
                <div className="min-w-0 max-w-full">
                    <p className="break-words font-medium text-zinc-100">{file.name}</p>
                    <p className="text-sm text-zinc-500">{fileTypeLabel(file.name)} file</p>
                </div>
                {note && <p className="text-sm text-zinc-400">{note}</p>}
                {children}
                <div className="flex flex-wrap justify-center gap-2">
                    {shareLink && (
                        <Button variant="secondary" size="sm" asChild>
                            <a href={shareLink} target="_blank" rel="noreferrer">
                                <ExternalLink className="h-4 w-4" />
                                Open in OneDrive
                            </a>
                        </Button>
                    )}
                    <Button variant="secondary" size="sm" asChild>
                        <a href={fileContentUrl(folderId, file, true)} download={file.name}>
                            <Download className="h-4 w-4" />
                            Download
                        </a>
                    </Button>
                </div>
            </div>
        </div>
    );
}
