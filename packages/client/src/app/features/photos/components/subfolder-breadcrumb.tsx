import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ArrowUp, ChevronRight } from 'lucide-react';
import { Fragment } from 'react';

interface SubfolderBreadcrumbProps {
    /** Current subfolder path within the album, e.g. "1940s/Spring". */
    path: string;
    albumName: string;
    onNavigate: (path: string) => void;
}

// Where the user is inside a browse album, following the album selector. Ancestors are links
// (desktop only, for space); the up button always goes one level toward the album root.
export function SubfolderBreadcrumb({ path, albumName, onNavigate }: SubfolderBreadcrumbProps) {
    const segments = path.split('/');
    const parentPath = segments.slice(0, -1).join('/');
    const parentName = segments.length > 1 ? segments[segments.length - 2] : albumName;

    return (
        <nav aria-label="Folder" className="flex min-w-0 items-center gap-1 text-sm">
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onNavigate(parentPath)}
                        aria-label={`Up to ${parentName}`}
                        className="shrink-0"
                    >
                        <ArrowUp className="h-4 w-4" />
                    </Button>
                </TooltipTrigger>
                <TooltipContent>Up to {parentName} (Esc)</TooltipContent>
            </Tooltip>
            {segments.map((name, i) => {
                const isLast = i === segments.length - 1;
                return (
                    <Fragment key={i}>
                        {i > 0 && <ChevronRight className="hidden h-4 w-4 shrink-0 text-muted-foreground sm:block" />}
                        {isLast ? (
                            <span className="truncate font-medium" title={name}>
                                {name}
                            </span>
                        ) : (
                            <button
                                type="button"
                                onClick={() => onNavigate(segments.slice(0, i + 1).join('/'))}
                                className="hidden shrink-0 text-muted-foreground hover:text-foreground hover:underline sm:inline"
                            >
                                {name}
                            </button>
                        )}
                    </Fragment>
                );
            })}
        </nav>
    );
}
