import { App } from '@/app';
import '@/assets/index.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

fetch('/api/version')
    .then((r) => r.json())
    .then(({ sha }: { sha: string }) => console.log(`kosh-central ${sha}`))
    .catch(() => {});

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <App />
    </StrictMode>,
);
