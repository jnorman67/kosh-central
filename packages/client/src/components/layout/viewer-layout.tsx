import type { ReactNode } from 'react';

interface ViewerLayoutProps {
    header: ReactNode;
    viewer: ReactNode;
    toolbar: ReactNode;
    rightPanel?: ReactNode;
}

export function ViewerLayout({ header, viewer, toolbar, rightPanel }: ViewerLayoutProps) {
    return (
        <div
            className="grid h-screen"
            style={{
                gridTemplateRows: 'auto 1fr auto',
                gridTemplateColumns: rightPanel ? '1fr auto' : '1fr',
                gridTemplateAreas: rightPanel ? '"header header" "viewer panel" "toolbar toolbar"' : '"header" "viewer" "toolbar"',
            }}
        >
            <header style={{ gridArea: 'header' }} className="border-b bg-background">
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
            <div style={{ gridArea: 'toolbar' }} className="border-t bg-background">
                {toolbar}
            </div>
        </div>
    );
}
