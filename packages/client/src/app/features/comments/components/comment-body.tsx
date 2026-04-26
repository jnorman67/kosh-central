interface CommentBodyProps {
    body: string;
}

const MENTION_RE = /@\[([^\]]+)\]\((user|person):([^)]+)\)/g;

export function CommentBody({ body }: CommentBodyProps) {
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    MENTION_RE.lastIndex = 0;
    while ((match = MENTION_RE.exec(body)) !== null) {
        if (match.index > lastIndex) {
            parts.push(body.slice(lastIndex, match.index));
        }
        parts.push(
            <span key={match.index} className="font-medium text-amber-700">
                @{match[1]}
            </span>,
        );
        lastIndex = match.index + match[0].length;
    }
    if (lastIndex < body.length) {
        parts.push(body.slice(lastIndex));
    }

    return <span className="whitespace-pre-wrap break-words">{parts}</span>;
}
