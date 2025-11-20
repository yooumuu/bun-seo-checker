import { api, handleResponse } from '.';
import type {
  LiveTaskEvent,
  ScanJob,
  ScanJobOptions,
  ScanPageWithMetrics,
} from '@shared/types';
import {
  queryOptions,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';

type Pagination = {
  total: number;
  limit: number;
  offset: number;
};

export type ScanListResponse = {
  jobs: ScanJob[];
  pagination: Pagination;
};

export type ScanPagesResponse = {
  pages: ScanPageWithMetrics[];
  pagination: Pagination;
};

export type ListScansParams = {
  limit?: number;
  offset?: number;
  search?: string;
  mode?: ScanJob['mode'];
  status?: ScanJob['status'];
  sort?: 'createdAt' | 'startedAt' | 'completedAt' | 'pagesTotal' | 'pagesFinished';
  direction?: 'asc' | 'desc';
};

export type ListScanPagesParams = {
  limit?: number;
  offset?: number;
  search?: string;
  status?: ScanPageWithMetrics['status'];
  sort?: 'createdAt' | 'url' | 'httpStatus' | 'loadTimeMs' | 'seoScore';
  direction?: 'asc' | 'desc';
};

export type CreateScanPayload = {
  targetUrl: string;
  mode: ScanJob['mode'];
  options?: Partial<ScanJobOptions>;
};

const toSearchParams = (params: Record<string, string | number | undefined>) =>
  Object.entries(params).reduce<Record<string, string>>((acc, [key, value]) => {
    if (value === undefined || value === null) return acc;
    acc[key] = String(value);
    return acc;
  }, {});

export const listScans = (params: ListScansParams = {}) => {
  const query = toSearchParams({
    limit: params.limit ?? 20,
    offset: params.offset ?? 0,
    search: params.search,
    mode: params.mode,
    status: params.status,
    sort: params.sort ?? 'createdAt',
    direction: params.direction ?? 'desc',
  });

  return handleResponse<ScanListResponse>(api.scans.$get({ query }));
};

export const getScansQueryOptions = (params: ListScansParams = {}) =>
  queryOptions({
    queryKey: ['scans', params],
    queryFn: () => listScans(params),
    staleTime: 1000 * 5,
  });

export const getScanById = (id: number | string) =>
  handleResponse<ScanJob>(
    api.scans[':id'].$get({ param: { id: String(id) } })
  );

export const getScanByIdQueryOptions = (id: number | string) =>
  queryOptions({
    queryKey: ['scan', id],
    queryFn: () => getScanById(id),
    staleTime: 1000 * 5,
  });

export const getScanPages = (
  id: number | string,
  params: ListScanPagesParams = {}
) => {
  const query = toSearchParams({
    limit: params.limit ?? 20,
    offset: params.offset ?? 0,
    search: params.search,
    status: params.status,
    sort: params.sort ?? 'createdAt',
    direction: params.direction ?? 'desc',
  });

  return handleResponse<ScanPagesResponse>(
    api.scans[':id'].pages.$get({
      param: { id: String(id) },
      query,
    })
  );
};

export const getScanPagesQueryOptions = (
  id: number | string,
  params: ListScanPagesParams = {}
) =>
  queryOptions({
    queryKey: ['scan-pages', id, params],
    queryFn: () => getScanPages(id, params),
    staleTime: 1000 * 5,
  });

export const getScanPageDetail = (scanId: number | string, pageId: number) =>
  handleResponse<ScanPageWithMetrics>(
    api.scans[':id'].pages[':pageId'].$get({
      param: {
        id: String(scanId),
        pageId: String(pageId),
      },
    })
  );

export const getScanPageDetailQueryOptions = (
  scanId: number | string,
  pageId: number
) =>
  queryOptions({
    queryKey: ['scan-page', scanId, pageId],
    queryFn: () => getScanPageDetail(scanId, pageId),
    staleTime: 1000 * 10,
  });

export const createScan = (payload: CreateScanPayload) =>
  handleResponse<ScanJob>(api.scans.$post({ json: payload }));

export const deleteScan = async (scanId: number | string) => {
  const response = await api.scans[':id'].$delete({
    param: { id: String(scanId) },
  });
  if (!response.ok) {
    throw new Error(`Failed to delete scan: ${response.statusText}`);
  }
};

export const cancelScan = async (scanId: number | string) => {
  return handleResponse<{ success: boolean; message: string }>(
    api.scans[':id'].cancel.$post({
      param: { id: String(scanId) },
    })
  );
};

export const retryScan = async (scanId: number | string) => {
  return handleResponse<{ success: boolean; message: string }>(
    api.scans[':id'].retry.$post({
      param: { id: String(scanId) },
    })
  );
};

export const useCreateScanMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateScanPayload) => createScan(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scans'] });
    },
  });
};

export const useDeleteScanMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (scanId: number) => deleteScan(scanId),
    onSuccess: (_data, scanId) => {
      queryClient.invalidateQueries({ queryKey: ['scans'] });
      queryClient.invalidateQueries({ queryKey: ['scan', scanId] });
      queryClient.invalidateQueries({ queryKey: ['scan-pages'] });
    },
  });
};

export const useCancelScanMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (scanId: number) => cancelScan(scanId),
    onSuccess: (_data, scanId) => {
      queryClient.invalidateQueries({ queryKey: ['scans'] });
      queryClient.invalidateQueries({ queryKey: ['scan', scanId] });
    },
  });
};

export const useRetryScanMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (scanId: number) => retryScan(scanId),
    onSuccess: (_data, scanId) => {
      queryClient.invalidateQueries({ queryKey: ['scans'] });
      queryClient.invalidateQueries({ queryKey: ['scan', scanId] });
    },
  });
};

export const useLiveScanEvents = () => {
  const [events, setEvents] = useState<LiveTaskEvent[]>([]);
  const sourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    let isMounted = true;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const handleMessage = (event: MessageEvent<string>) => {
      try {
        const payload = JSON.parse(event.data) as
          | { type: 'init'; events: LiveTaskEvent[] }
          | { type: 'event'; event: LiveTaskEvent };

        if (payload.type === 'init') {
          setEvents(payload.events);
        } else if (payload.type === 'event' && payload.event) {
          setEvents((prev) => [...prev.slice(-99), payload.event]);
        }
      } catch (error) {
        console.error('Failed to parse SSE payload', error);
      }
    };

    const connect = () => {
      if (!isMounted) return;
      const source = new EventSource('/api/scans/progress/live');
      sourceRef.current = source;
      source.addEventListener('message', handleMessage);
      source.onerror = () => {
        source.removeEventListener('message', handleMessage);
        source.close();
        sourceRef.current = null;
        if (isMounted && !reconnectTimer) {
          reconnectTimer = setTimeout(() => {
            reconnectTimer = null;
            connect();
          }, 2000);
        }
      };
    };

    connect();

    return () => {
      isMounted = false;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
      if (sourceRef.current) {
        sourceRef.current.removeEventListener('message', handleMessage);
        sourceRef.current.close();
        sourceRef.current = null;
      }
    };
  }, []);

  const latestJobs = useMemo(() => {
    const ordered = [...events].sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    });

    const byJob = new Map<number, LiveTaskEvent>();
    for (const event of ordered) {
      byJob.set(event.jobId, event);
    }

    return Array.from(byJob.values());
  }, [events]);

  return { events, latestJobs };
};
