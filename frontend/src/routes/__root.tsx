import { LiveTaskDock } from '@/components/live-task-dock';
import { createRootRoute, Link, Outlet } from '@tanstack/react-router';
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools';

const navLinks = [
  { to: '/', label: '仪表盘' },
  { to: '/history', label: '历史记录' },
];

export const Route = createRootRoute({
  component: () => (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div>
            <p className="text-xs uppercase text-slate-400">Bun SEO Checker</p>
            <p className="text-base font-semibold text-slate-900">
              SEO / UTM / 埋点检测器
            </p>
          </div>
          <nav className="flex gap-4 text-sm font-medium text-slate-600">
            {navLinks.map((item) => (
              <Link
                key={item.to}
                to={item.to as '/' | '/history'}
                className="[&.active]:text-slate-900 [&.active]:underline"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
      <LiveTaskDock />
      <TanStackRouterDevtools />
    </div>
  ),
});
