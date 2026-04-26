import type { ReactNode } from 'react';

interface ViewerLayoutProps {
    header: ReactNode;
    viewer: ReactNode;
    toolbar?: ReactNode;
    rightPanel?: ReactNode;
    mobilePanel?: ReactNode;
}

export function ViewerLayout({ header, viewer, toolbar, rightPanel, mobilePanel }: ViewerLayoutProps) {
    return (
        <div className="flex h-dvh flex-col">
            <header className="shrink-0 border-b border-amber-200 bg-gradient-to-b from-amber-100/70 to-background">{header}</header>
            <div className="flex min-h-0 flex-1 flex-col md:flex-row">
                <main className="min-w-0 flex-1 overflow-hidden">{viewer}</main>
                {mobilePanel && (
                    <div className="max-h-[45vh] shrink-0 overflow-auto border-t border-amber-200 md:hidden">{mobilePanel}</div>
                )}
                {rightPanel && <aside className="hidden w-80 overflow-auto border-l bg-background md:block">{rightPanel}</aside>}
            </div>
            {toolbar !== undefined && (
                <div className="shrink-0 border-t border-amber-200 bg-gradient-to-t from-amber-100/70 to-background">{toolbar}</div>
            )}
        </div>
    );
}
