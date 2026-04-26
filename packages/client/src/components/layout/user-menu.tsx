import { useAuthQueries } from '@/app/features/auth/contexts/auth-query.context';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronDown, FolderCog, KeyRound, LogOut, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function UserMenu() {
    const navigate = useNavigate();
    const { useGetMe, useLogout } = useAuthQueries();
    const { data: me } = useGetMe();
    const logout = useLogout();

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
                {isAdmin && (
                    <DropdownMenuItem onSelect={() => navigate('/admin/folders')}>
                        <FolderCog />
                        Folders
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
