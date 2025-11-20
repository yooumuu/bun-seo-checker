
import { Link, Outlet, useLocation } from '@tanstack/react-router';
import {
    LayoutDashboard,
    History,
    Menu,
    X,
    ScanLine,
    ListTodo,
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

export function DashboardLayout() {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const location = useLocation();

    const navigation = [
        { name: '概览', href: '/', icon: LayoutDashboard },
        { name: '任务管理', href: '/tasks', icon: ListTodo },
        { name: '历史记录', href: '/history', icon: History },
        // { name: '设置', href: '/settings', icon: Settings },
    ];

    return (
        <div className="min-h-screen bg-background font-sans text-foreground">
            {/* Mobile sidebar backdrop */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside
                className={cn(
                    'fixed inset-y-0 left-0 z-50 w-72 transform border-r border-sidebar-border bg-sidebar transition-transform duration-200 ease-in-out lg:translate-x-0',
                    isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
                )}
            >
                <div className="flex h-16 items-center border-b border-sidebar-border px-6">
                    <Link to="/" className="flex items-center gap-2 font-bold text-xl text-sidebar-primary">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                            <ScanLine className="h-5 w-5" />
                        </div>
                        <span>SEO Checker</span>
                    </Link>
                    <button
                        className="ml-auto lg:hidden"
                        onClick={() => setIsSidebarOpen(false)}
                    >
                        <X className="h-6 w-6 text-sidebar-foreground/70" />
                    </button>
                </div>

                <nav className="flex flex-1 flex-col gap-1 p-4">
                    {navigation.map((item) => {
                        const isActive = location.pathname === item.href || (item.href !== '/' && location.pathname.startsWith(item.href));
                        return (
                            <Link
                                key={item.name}
                                to={item.href}
                                onClick={() => setIsSidebarOpen(false)}
                                className={cn(
                                    'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
                                    isActive
                                        ? 'bg-sidebar-accent text-sidebar-accent-foreground shadow-sm'
                                        : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                                )}
                            >
                                <item.icon
                                    className={cn(
                                        'h-5 w-5 transition-colors',
                                        isActive
                                            ? 'text-sidebar-primary'
                                            : 'text-sidebar-foreground/50 group-hover:text-sidebar-foreground/70'
                                    )}
                                />
                                {item.name}
                            </Link>
                        );
                    })}
                </nav>

                <div className="border-t border-sidebar-border p-4">
                    <div className="rounded-lg bg-sidebar-accent/50 p-4 text-xs text-sidebar-foreground/60">
                        <p className="font-medium text-sidebar-foreground">SEO Checker</p>
                        <p className="mt-1">v0.1.0 Beta</p>
                    </div>
                </div>
            </aside>

            {/* Main content */}
            <div className="lg:pl-72">
                <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-border bg-background/80 px-6 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                    <button
                        className="lg:hidden"
                        onClick={() => setIsSidebarOpen(true)}
                    >
                        <Menu className="h-6 w-6 text-muted-foreground" />
                    </button>
                    <div className="flex flex-1 items-center justify-between">
                        <h1 className="text-lg font-semibold text-foreground">
                            {navigation.find((n) => n.href === location.pathname)?.name ?? 'Dashboard'}
                        </h1>
                        <div className="flex items-center gap-4">
                            {/* Add user menu or other actions here */}
                        </div>
                    </div>
                </header>

                <main className="p-6 lg:p-10">
                    <div className="mx-auto max-w-6xl">
                        <Outlet />
                    </div>
                </main>
            </div>
        </div>
    );
}
