import type { Example, NewExample, UpdateExample } from '@shared/types';
import { handleResponse, api } from '.';
import {
  queryOptions,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';

// 获取所有例子
export const getAllExamples = () =>
  handleResponse<{ examples: Example[] }>(api.examples.$get());

// 获取所有例子的 query options
export const getAllExamplesQueryOptions = queryOptions({
  queryKey: ['get-examples-list'] as const,
  queryFn: getAllExamples,
  staleTime: 1000 * 60 * 5, // 5分钟
});

// 获取单个例子
export const getExampleById = ({ id }: { id: string }) =>
  handleResponse<Example>(api.examples[':id'].$get({ param: { id } }));

// 获取单个例子的 query options
export const getExampleByIdQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ['example', id] as const,
    queryFn: () => getExampleById({ id }),
    staleTime: 1000 * 60 * 5, // 5分钟
  });

// 创建新例子
export const createExample = ({ value }: { value: NewExample }) =>
  handleResponse<Example>(api.examples.$post({ json: value }));

// 创建新例子的 mutation
export const useCreateExampleMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ value }: { value: NewExample }) => createExample({ value }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['get-examples-list'] });
    },
  });
};

// 更新例子
export const updateExample = ({
  id,
  value,
}: {
  id: string;
  value: UpdateExample;
}) =>
  handleResponse<Example>(
    api.examples[':id'].$put({
      param: { id },
      json: value,
    })
  );

// 更新例子的 mutation
export const useUpdateExampleMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, value }: { id: string; value: UpdateExample }) =>
      updateExample({ id, value }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['get-examples-list'] });
    },
  });
};

// 删除例子
export const deleteExample = ({ id }: { id: string }) =>
  api.examples[':id'].$delete({ param: { id } });

// 删除例子的 mutation
export const useDeleteExampleMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id }: { id: string }) => deleteExample({ id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['get-examples-list'] });
    },
  });
};
