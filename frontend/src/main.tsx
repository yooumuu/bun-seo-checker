import { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider, createRouter } from '@tanstack/react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './index.css';

// 导入生成的路由树
import { routeTree } from './routeTree.gen';

// 创建一个 React Query 客户端实例，用于管理应用的数据请求和缓存
const queryClient = new QueryClient();

// 创建一个 TanStack Router 实例，并将 queryClient 作为上下文传递
const router = createRouter({ routeTree, context: { queryClient } });

// 为了 TypeScript 类型安全，注册路由器实例
// 这确保了在使用 TanStack Router 时能获得完整的类型检查和自动补全
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

// 渲染应用
const rootElement = document.getElementById('root')!;
if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </StrictMode>
  );
}
