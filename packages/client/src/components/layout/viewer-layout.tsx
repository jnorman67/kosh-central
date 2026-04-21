import type { ReactNode } from 'react';

interface ViewerLayoutProps {
    header: ReactNode;
    viewer: ReactNode;
    toolbar?: ReactNode;
    rightPanel?: ReactNode;
}

export function ViewerLayout({ header, viewer, toolbar, rightPanel }: ViewerLayoutProps) {
    return (
        <div className="flex h-dvh flex-col">
            <header className="shrink-0 border-b border-amber-200 bg-gradient-to-b from-amber-100/70 to-background">{header}</header>
            <div className="flex min-h-0 flex-1">
                <main className="min-w-0 flex-1 overflow-hidden">{viewer}</main>
                {rightPanel && <aside className="hidden w-80 overflow-auto border-l bg-background md:block">{rightPanel}</aside>}
            </div>
            {toolbar !== undefined && (
                <div className="shrink-0 border-t border-amber-200 bg-gradient-to-t from-amber-100/70 to-background">{toolbar}</div>
            )}
        </div>
    );
}
