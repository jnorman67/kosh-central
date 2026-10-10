import type { AdminPerson } from '@/app/features/admin/models/person.models';
import { useAuthQueries } from '@/app/features/auth/contexts/auth-query.context';
import { useFeaturedQueries } from '@/app/features/featured/contexts/featured-query.context';
import { forgetPlaces } from '@/app/features/photos/lib/places';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { apiFetch } from '@/lib/api-client';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, CircleUser, FolderCog, KeyRound, LogOut, Sparkles, UserCog, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function UserMenu() {
    const navigate = useNavigate();
    const { useGetMe, useLogout } = useAuthQueries();
    const { data: me } = useGetMe();
    const logout = useLogout();
    const { useGetFeatured } = useFeaturedQueries();
    const { data: featured } = useGetFeatured();
    // Admins see how many user-suggested names await review. Shares the cache with comment mention candidates.
    const { data: persons } = useQuery({
        queryKey: ['Persons', 'All'],
        queryFn: () => apiFetch<AdminPerson[]>('/api/persons'),
        staleTime: 5 * 60 * 1000,
        enabled: me?.role === 'admin',
    });
    const pendingCount = persons?.filter((p) => p.proposed).length ?? 0;

    if (!me) return null;

    const isAdmin = me.role === 'admin';

    function handleLogout() {
        logout.mutate(undefined, {
            onSuccess: () => {
                forgetPlaces();
                navigate('/login', { replace: true });
            },
        });
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="text-muted-foreground" aria-label={me.displayName}>
                    <CircleUser className="h-5 w-5 sm:hidden" />
                    <span className="hidden sm:inline">{me.displayName}</span>
                    <ChevronDown className="hidden h-3 w-3 opacity-60 sm:block" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                {featured?.enabled && (
                    <>
                        <DropdownMenuItem onSelect={() => navigate('/featured')}>
                            <Sparkles />
                            {featured.eyebrow || featured.title}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                    </>
                )}
                {isAdmin && (
                    <DropdownMenuItem onSelect={() => navigate('/admin/folders')}>
                        <FolderCog />
                        Folders
                    </DropdownMenuItem>
                )}
                {isAdmin && (
                    <DropdownMenuItem onSelect={() => navigate('/admin/featured')}>
                        <Sparkles />
                        Featured album
                    </DropdownMenuItem>
                )}
                {isAdmin && (
                    <DropdownMenuItem onSelect={() => navigate('/admin/users')}>
                        <UserCog />
                        Users & invites
                    </DropdownMenuItem>
                )}
                <DropdownMenuItem onSelect={() => navigate('/persons')}>
                    <Users />
                    Persons
                    {isAdmin && pendingCount > 0 && (
                        <span
                            className="ml-auto rounded-full bg-amber-500/15 px-1.5 text-xs font-medium text-amber-700 dark:text-amber-300"
                            title={`${pendingCount} suggested name${pendingCount !== 1 ? 's' : ''} awaiting review`}
                        >
                            {pendingCount}
                        </span>
                    )}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => navigate('/account/password')}>
                    <KeyRound />
                    Change password
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={handleLogout}>
                    <LogOut />
                    Sign out
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
