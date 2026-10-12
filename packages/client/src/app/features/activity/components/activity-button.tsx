import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { MessageCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useActivityQueries } from '../contexts/activity-query.context';

/** Header shortcut to the activity feed, badged with how many photos have new comments from others. */
export function ActivityButton() {
    const navigate = useNavigate();
    const { useGetStatus } = useActivityQueries();
    const { data: status } = useGetStatus();
    const unseen = status?.unseenCount ?? 0;
    const label = unseen > 0 ? `Activity: ${unseen} photo${unseen !== 1 ? 's' : ''} with new comments` : 'Activity';

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate('/activity')}
                    aria-label={label}
                    className="relative text-muted-foreground"
                >
                    <MessageCircle className="h-4 w-4" />
                    <span className="hidden lg:inline">Activity</span>
                    {unseen > 0 && (
                        <span className="absolute right-0.5 top-0 min-w-4 rounded-full bg-rose-500 px-1 text-[10px] font-semibold leading-4 text-white lg:static lg:ml-0.5">
                            {unseen > 9 ? '9+' : unseen}
                        </span>
                    )}
                </Button>
            </TooltipTrigger>
            <TooltipContent>{label}</TooltipContent>
        </Tooltip>
    );
}
