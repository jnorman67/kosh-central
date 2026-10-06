import { useAuthQueries } from '@/app/features/auth/contexts/auth-query.context';
import { useFeaturedQueries } from '@/app/features/featured/contexts/featured-query.context';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronDown, FolderCog, KeyRound, LogOut, Sparkles, UserCog, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function UserMenu() {
    const navigate = useNavigate();
    const { useGetMe, useLogout } = useAuthQueries();
    const { data: me } = useGetMe();
    const logout = useLogout();
    const { useGetFeatured } = useFeaturedQueries();
    const { data: featured } = useGetFeatured();

    if (!me) return null;

    const isAdmin = me.role === 'admin';

    function handleLogout() {
        logout.mutate(undefined, { onSuccess: () => navigate('/login', { replace: true }) });
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="text-muted-foreground">
                    {me.displayName}
                    <ChevronDown className="h-3 w-3 opacity-60" />
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
