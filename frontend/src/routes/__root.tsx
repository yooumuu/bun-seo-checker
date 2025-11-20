import { createRootRoute } from '@tanstack/react-router';
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools';
import { DashboardLayout } from '@/components/layout/dashboard-layout';

export const Route = createRootRoute({
  component: () => (
    <>
      <DashboardLayout />
      <TanStackRouterDevtools />
    </>
  ),
});
