import {
  getAllExamplesQueryOptions,
  useCreateExampleMutation,
  useUpdateExampleMutation,
  useDeleteExampleMutation,
} from '@/lib/api/examples';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useForm, useStore } from '@tanstack/react-form';
import {
  type Example,
  type NewExample,
  type UpdateExample,
  InsertExampleSchema,
  UpdateExampleSchema,
} from '@shared/types';
import { useState } from 'react';

export const Route = createFileRoute('/examples')({
  component: RouteComponent,
});

function RouteComponent() {
  // 获取所有例子
  const {
    isPending,
    isError,
    data: examplesData,
    error,
  } = useQuery(getAllExamplesQueryOptions);

  // 创建新例子的 mutation
  const createMutation = useCreateExampleMutation();
  // 更新例子的 mutation
  const updateMutation = useUpdateExampleMutation();
  // 删除例子的 mutation
  const deleteMutation = useDeleteExampleMutation();

  // 当前选中用于更新/删除的例子
  const [selectedExample, setSelectedExample] = useState<Example | null>(null);

  // 创建新例子的表单
  const createForm = useForm({
    defaultValues: {
      name: '',
      description: '',
      count: 0,
    } as NewExample,
    validators: { onChange: InsertExampleSchema },
    onSubmit: async ({ value }) => {
      // 创建新例子
      const newExample: NewExample = {
        name: value.name,
        description: value.description,
        count: value.count,
      };
      createMutation.mutate({ value: newExample });
      // 重置表单
      createForm.reset();
    },
  });

  // 更新例子的表单
  const updateForm = useForm({
    defaultValues: {
      name: '',
      description: '',
      count: 0,
    } as UpdateExample,
    validators: { onChange: UpdateExampleSchema },
    onSubmit: async ({ value }) => {
      if (!selectedExample) return;

      const updatedExample: UpdateExample = {
        name: value.name,
        description: value.description || undefined,
        count: value.count || undefined,
      };

      updateMutation.mutate({
        id: selectedExample.id.toString(),
        value: updatedExample,
      });
      // 清空选中状态
      setSelectedExample(null);
      // 重置表单
      updateForm.reset();
    },
  });

  // 监听创建表单中的错误状态
  const createFormCanSubmit = useStore(
    createForm.store,
    (state) => state.canSubmit
  );

  // 监听更新表单中的错误状态
  const updateFormCanSubmit = useStore(
    updateForm.store,
    (state) => state.canSubmit
  );

  // 选中例子进行更新/删除
  const handleSelectExample = (example: Example) => {
    setSelectedExample(example);
    // 设置更新表单的初始值
    updateForm.setFieldValue('name', example.name);
    updateForm.setFieldValue('description', example.description || '');
    updateForm.setFieldValue('count', example.count || 0);
  };

  // 处理删除例子
  const handleDelete = (id: number) => {
    deleteMutation.mutate({ id: id.toString() });
    // 如果删除的是当前选中的例子，则清空选中状态
    if (selectedExample?.id === id) {
      setSelectedExample(null);
      updateForm.reset();
    }
  };

  if (isPending) {
    return <div>加载中...</div>;
  }

  if (isError) {
    return <div>加载出错: {error?.message}</div>;
  }

  const examples: Example[] = (examplesData as { examples: Example[] } | undefined)?.examples || [];

  return (
    <div>
      <h1>例子列表 (共 {examples.length} 个)</h1>

      {/* 例子列表 */}
      <ul>
        {examples.map((example) => (
          <li key={example.id}>
            ID: {example.id}, 名称: {example.name}, 描述:{' '}
            {example.description || '无'}, 计数: {example.count || 0}
            <button onClick={() => handleSelectExample(example)}>编辑</button>
            <button
              onClick={() => handleDelete(example.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? '删除中...' : '删除'}
            </button>
          </li>
        ))}
      </ul>

      <hr />

      {/* 创建新例子表单 */}
      <h2>创建新例子</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          createForm.handleSubmit();
        }}
      >
        <div>
          <label>
            名称:
            <createForm.Field
              name="name"
              validators={{
                onChange: ({ value }) => (!value ? '名称不能为空' : undefined),
              }}
            >
              {(field) => (
                <input
                  type="text"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
              )}
            </createForm.Field>
          </label>
        </div>
        <div>
          <label>
            描述:
            <createForm.Field name="description">
              {(field) => (
                <input
                  type="text"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
              )}
            </createForm.Field>
          </label>
        </div>
        <div>
          <label>
            计数:
            <createForm.Field name="count">
              {(field) => (
                <input
                  type="number"
                  value={field.state.value}
                  onChange={(e) =>
                    field.handleChange(parseInt(e.target.value, 10) || 0)
                  }
                />
              )}
            </createForm.Field>
          </label>
        </div>
        <button
          type="submit"
          disabled={createMutation.isPending || !createFormCanSubmit}
        >
          {createMutation.isPending ? '创建中...' : '创建'}
        </button>
        {createMutation.isError && (
          <div>创建出错: {createMutation.error?.message}</div>
        )}
      </form>

      <hr />

      {/* 更新/删除例子区域 */}
      <h2>编辑例子</h2>
      {selectedExample ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            updateForm.handleSubmit();
          }}
        >
          <p>当前编辑 ID: {selectedExample.id}</p>
          <div>
            <label>
              名称:
              <updateForm.Field
                name="name"
                validators={{
                  onChange: ({ value }) =>
                    !value ? '名称不能为空' : undefined,
                }}
              >
                {(field) => (
                  <input
                    type="text"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                )}
              </updateForm.Field>
            </label>
          </div>
          <div>
            <label>
              描述:
              <updateForm.Field name="description">
                {(field) => (
                  <input
                    type="text"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                )}
              </updateForm.Field>
            </label>
          </div>
          <div>
            <label>
              计数:
              <updateForm.Field name="count">
                {(field) => (
                  <input
                    type="number"
                    value={field.state.value}
                    onChange={(e) =>
                      field.handleChange(parseInt(e.target.value, 10) || 0)
                    }
                  />
                )}
              </updateForm.Field>
            </label>
          </div>
          <button
            type="submit"
            disabled={updateMutation.isPending || !updateFormCanSubmit}
          >
            {updateMutation.isPending ? '更新中...' : '更新'}
          </button>
          <button
            type="button"
            onClick={() => {
              setSelectedExample(null);
              updateForm.reset();
            }}
            disabled={updateMutation.isPending}
          >
            取消
          </button>
          {updateMutation.isError && (
            <div>更新出错: {updateMutation.error?.message}</div>
          )}
        </form>
      ) : (
        <p>请从列表中选择一个例子进行编辑。</p>
      )}
    </div>
  );
}
