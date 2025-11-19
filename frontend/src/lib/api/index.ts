import { hc } from 'hono/client';
import { type ApiRoutes } from '@shared/types';

const client = hc<ApiRoutes>('/');

export const api = client.api;

// 通用的响应处理函数
export const handleResponse = async <T>(
  responsePromise: Promise<Response>
): Promise<T> => {
  const response = await responsePromise;
  if (!response.ok) {
    throw new Error(`API error: ${response.statusText}`);
  }
  return response.json() as Promise<T>;
};
