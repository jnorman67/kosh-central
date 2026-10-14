import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Copy, Share } from 'lucide-react';
import { useEffect, useState } from 'react';

const COPIED_MS = 2000;

export interface SendLink {
    title: string;
    /** What opening the link does, shown above it. */
    description: string;
    url: string;
    expiresAt: string;
}

/**
 * Shows a freshly created sign-in or invite link for the admin to send. The link is fetched
 * before the dialog opens, so the copy/share click is its own user gesture (Safari refuses
 * clipboard writes that follow an await).
 */
export function SendLinkDialog({ link, onClose }: { link: SendLink | null; onClose: () => void }) {
    const [copied, setCopied] = useState(false);
    const canShare = typeof navigator.share === 'function';

    useEffect(() => {
        if (!copied) return;
        const timer = window.setTimeout(() => setCopied(false), COPIED_MS);
        return () => window.clearTimeout(timer);
    }, [copied]);

    async function copy() {
        if (!link) return;
        try {
            await navigator.clipboard.writeText(link.url);
            setCopied(true);
        } catch {
            window.prompt('Copy this link:', link.url);
        }
    }

    async function share() {
        if (!link) return;
        try {
            await navigator.share({ title: 'Kosh Central', url: link.url });
        } catch (err) {
            // Dismissing the sheet isn't a failure; anything else falls back to copying.
            if (!(err instanceof DOMException && err.name === 'AbortError')) await copy();
        }
    }

    return (
        <Dialog open={link !== null} onOpenChange={(open) => !open && onClose()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{link?.title}</DialogTitle>
                    <DialogDescription>
                        {link?.description} Works once, until {link && new Date(link.expiresAt).toLocaleDateString()}. Send it by text or
                        email.
                    </DialogDescription>
                </DialogHeader>
                <Input readOnly value={link?.url ?? ''} onFocus={(e) => e.currentTarget.select()} className="font-mono text-xs" />
                <DialogFooter className="gap-2">
                    {canShare && (
                        <Button variant="outline" onClick={share}>
                            <Share className="h-4 w-4" />
                            Share…
                        </Button>
                    )}
                    <Button onClick={copy}>
                        <Copy className="h-4 w-4" />
                        {copied ? 'Copied' : 'Copy link'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
