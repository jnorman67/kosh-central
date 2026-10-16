import { fileKind, fileTypeLabel } from '@/app/features/photos/lib/files';
import type { Photo } from '@/app/features/photos/models/photos.models';
import type { LucideIcon } from 'lucide-react';
import { File, FileArchive, FileAudio, FileSpreadsheet, FileText, FileVideo, Play } from 'lucide-react';
import { useState } from 'react';

const ICON_BY_EXTENSION: Record<string, LucideIcon> = {
    CSV: FileSpreadsheet,
    XLS: FileSpreadsheet,
    XLSX: FileSpreadsheet,
    ODS: FileSpreadsheet,
    DOC: FileText,
    DOCX: FileText,
    RTF: FileText,
    ODT: FileText,
    ZIP: FileArchive,
    '7Z': FileArchive,
    RAR: FileArchive,
};

export function FileTypeIcon({ file, className }: { file: Photo; className?: string }) {
    const kind = fileKind(file);
    const Icon =
        kind === 'video'
            ? FileVideo
            : kind === 'audio'
              ? FileAudio
              : (ICON_BY_EXTENSION[fileTypeLabel(file.name)] ?? (kind === 'pdf' || kind === 'text' ? FileText : File));
    return <Icon className={className} aria-hidden />;
}

interface FileThumbnailProps {
    file: Photo;
    /** Classes for the picture: a photo's own, or a document's OneDrive preview. */
    imgClassName?: string;
    /** Pictures load their full image rather than the thumbnail (the pages reader shows them large). */
    fullImage?: boolean;
}

/**
 * A file as gallery tiles show it. A photo is its picture; a document is its OneDrive preview
 * when there is one (and it loads), else an icon and its name, badged with its type either way.
 */
export function FileThumbnail({ file, imgClassName, fullImage }: FileThumbnailProps) {
    const [previewFailed, setPreviewFailed] = useState(false);
    const kind = fileKind(file);
    if (kind === 'image') {
        return (
            <img
                src={fullImage ? file.downloadUrl : (file.thumbnailUrl ?? file.downloadUrl)}
                alt={file.name}
                loading="lazy"
                className={imgClassName}
            />
        );
    }
    return (
        <div className="relative h-full w-full">
            {file.thumbnailUrl && !previewFailed ? (
                <img
                    src={file.thumbnailUrl}
                    alt={file.name}
                    loading="lazy"
                    onError={() => setPreviewFailed(true)}
                    className={imgClassName}
                />
            ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-3 text-zinc-400">
                    <FileTypeIcon file={file} className="h-10 w-10 shrink-0" />
                    <span className="line-clamp-2 break-all text-center text-xs">{file.name}</span>
                </div>
            )}
            <span className="absolute bottom-1 left-1 flex items-center gap-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white">
                {kind === 'video' && <Play className="h-3 w-3" aria-hidden />}
                {fileTypeLabel(file.name)}
            </span>
        </div>
    );
}
