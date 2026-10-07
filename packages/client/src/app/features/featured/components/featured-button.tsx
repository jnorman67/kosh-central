import { useFeaturedQueries } from '@/app/features/featured/contexts/featured-query.context';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

/** Header shortcut to the featured album page: an icon on phones, labelled on wide screens.
 *  Renders nothing while no album is featured. */
export function FeaturedButton() {
    const navigate = useNavigate();
    const { useGetFeatured } = useFeaturedQueries();
    const { data: featured } = useGetFeatured();

    if (!featured?.enabled) return null;

    const label = featured.eyebrow || featured.title || 'Featured album';

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate('/featured')}
                    aria-label={label}
                    className="min-w-0 text-amber-700 hover:bg-amber-50 hover:text-amber-800"
                >
                    <Sparkles className="h-4 w-4" />
                    <span className="hidden max-w-[16rem] truncate lg:inline">{label}</span>
                </Button>
            </TooltipTrigger>
            <TooltipContent>{label}</TooltipContent>
        </Tooltip>
    );
}
