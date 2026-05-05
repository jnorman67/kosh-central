import Anthropic from '@anthropic-ai/sdk';
import type { ImageBlockParam, TextBlockParam } from '@anthropic-ai/sdk/resources/messages.js';

const client = new Anthropic();

const PROMPT =
    'Look carefully at this photograph (front and back if both are provided). ' +
    'Describe any text visible — printed labels, stamps, handwritten notes, captions, dates, names — ' +
    'and indicate where each piece of text appears (e.g. "front, top right", "back, pencil note at bottom"). ' +
    'If there is no visible text at all, reply with exactly: NO TEXT.';

async function fetchAsBase64(downloadUrl: string): Promise<{ base64: string; mediaType: string }> {
    const res = await fetch(downloadUrl, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) throw new Error(`Failed to fetch image: ${res.status} ${res.statusText}`);
    const contentType = res.headers.get('content-type') ?? 'image/jpeg';
    const mediaType = contentType.startsWith('image/') ? contentType : 'image/jpeg';
    const base64 = Buffer.from(await res.arrayBuffer()).toString('base64');
    return { base64, mediaType };
}

export class AnthropicOcrService {
    /** downloadUrls: [frontUrl, backUrl?] — at least one required. */
    async extractText(downloadUrls: string[]): Promise<string> {
        const fetched = await Promise.all(downloadUrls.map(fetchAsBase64));

        const imageBlocks: ImageBlockParam[] = fetched.map(({ base64, mediaType }) => ({
            type: 'image',
            source: {
                type: 'base64',
                media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
                data: base64,
            },
        }));

        const textBlock: TextBlockParam = { type: 'text', text: PROMPT };

        const response = await client.messages.create({
            model: 'claude-opus-4-7',
            max_tokens: 1024,
            messages: [{ role: 'user', content: [...imageBlocks, textBlock] }],
        });

        const block = response.content.find((b) => b.type === 'text');
        return block?.type === 'text' ? block.text.trim() : '';
    }
}
