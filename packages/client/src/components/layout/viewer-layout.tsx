import type { ReactNode } from 'react';

interface ViewerLayoutProps {
    header: ReactNode;
    viewer: ReactNode;
    toolbar?: ReactNode;
    rightPanel?: ReactNode;
}

export function ViewerLayout({ header, viewer, toolbar, rightPanel }: ViewerLayoutProps) {
    const hasToolbar = toolbar !== undefined;
    const rows = hasToolbar ? 'auto 1fr auto' : 'auto 1fr';
    const areas = rightPanel
        ? hasToolbar
            ? '"header header" "viewer panel" "toolbar toolbar"'
            : '"header header" "viewer panel"'
        : hasToolbar
          ? '"header" "viewer" "toolbar"'
          : '"header" "viewer"';

    return (
        <div
            className="grid h-screen"
            style={{
                gridTemplateRows: rows,
                gridTemplateColumns: rightPanel ? '1fr auto' : '1fr',
                gridTemplateAreas: areas,
            }}
        >
            <header style={{ gridArea: 'header' }} className="border-b border-amber-200 bg-gradient-to-b from-amber-100/70 to-background">
                {header}
            </header>
            <main style={{ gridArea: 'viewer' }} className="min-h-0 overflow-hidden">
                {viewer}
            </main>
            {rightPanel && (
                <aside style={{ gridArea: 'panel' }} className="w-80 overflow-auto border-l bg-background">
                    {rightPanel}
                </aside>
            )}
            {hasToolbar && (
                <div style={{ gridArea: 'toolbar' }} className="border-t border-amber-200 bg-gradient-to-t from-amber-100/70 to-background">
                    {toolbar}
                </div>
            )}
        </div>
    );
}
