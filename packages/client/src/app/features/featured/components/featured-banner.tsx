import { useFeaturedQueries } from '@/app/features/featured/contexts/featured-query.context';
import { ChevronRight, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

/** Full-width card above the album list that leads back to the featured album page. Renders
 *  nothing while no album is featured. */
export function FeaturedBanner() {
    const navigate = useNavigate();
    const { useGetFeatured } = useFeaturedQueries();
    const { data: featured } = useGetFeatured();

    if (!featured?.enabled) return null;

    const photo = featured.photos[0];
    const title = featured.title || featured.folderDisplayName;

    return (
        <button
            type="button"
            onClick={() => navigate('/featured')}
            className="group mb-6 flex w-full items-center gap-3 rounded-lg bg-gradient-to-r from-amber-500/25 via-orange-500/15 to-transparent p-2 pr-3 text-left ring-1 ring-amber-400/50 outline-none transition-colors hover:from-amber-500/35 focus-visible:ring-2 focus-visible:ring-white sm:gap-4 sm:p-3 sm:pr-4"
        >
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-md bg-zinc-900 ring-1 ring-white/15 sm:h-20 sm:w-20">
                {photo ? (
                    <img src={photo.thumbnailUrl ?? photo.imageUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                    <div className="flex h-full w-full items-center justify-center">
                        <Sparkles className="h-6 w-6 text-amber-400" />
                    </div>
                )}
            </div>
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-amber-400">
                    <Sparkles className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{featured.eyebrow || 'Featured album'}</span>
                </div>
                <div className="truncate font-serif text-lg font-semibold text-white sm:text-xl">{title}</div>
                {featured.subtitle && <div className="truncate text-sm text-zinc-300">{featured.subtitle}</div>}
            </div>
            <ChevronRight className="h-5 w-5 shrink-0 text-amber-400 transition-transform group-hover:translate-x-0.5" />
        </button>
    );
}
