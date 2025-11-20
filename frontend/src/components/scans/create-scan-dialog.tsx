import { useForm, useStore } from '@tanstack/react-form';
import { useCreateScanMutation } from '@/lib/api/scans';
import type { ScanJob } from '@shared/types';
import { cn } from '@/lib/utils';
import { X, Loader2, Globe, FileText, Settings2 } from 'lucide-react';
import { useState } from 'react';
import { ScanTrackingModal } from './scan-tracking-modal';

type FormValues = {
    targetUrl: string;
    mode: ScanJob['mode'];
    options: {
        siteDepth?: number;
        maxPages?: number;
        userAgent?: string;
        requestTimeoutMs?: number;
    };
};

interface CreateScanDialogProps {
    isOpen: boolean;
    onClose: () => void;
}

export function CreateScanDialog({ isOpen, onClose }: CreateScanDialogProps) {
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [trackingScanId, setTrackingScanId] = useState<number | null>(null);
    const createMutation = useCreateScanMutation();

    const form = useForm({
        defaultValues: {
            targetUrl: '',
            mode: 'single' as ScanJob['mode'],
            options: {
                siteDepth: 2,
                maxPages: 150,
                userAgent: '',
                requestTimeoutMs: 15000,
            },
        },
        onSubmit: async ({ value }) => {
            const { targetUrl, mode, options } = value;
            const normalizedOptions = Object.fromEntries(
                Object.entries(options).filter(
                    ([, v]) => v !== undefined && v !== null && v !== ''
                )
            );
            const result = await createMutation.mutateAsync({
                targetUrl,
                mode,
                options:
                    Object.keys(normalizedOptions).length > 0
                        ? (normalizedOptions as FormValues['options'])
                        : undefined,
            });
            form.reset();
            onClose();
            // Open tracking modal with the newly created scan
            setTrackingScanId(result.id);
        },
    });

    const canSubmit = useStore(form.store, (state) => state.canSubmit);
    const modeValue = useStore(form.store, (state) => state.values.mode);

    if (!isOpen) return (
        <>
            {trackingScanId && (
                <ScanTrackingModal
                    scanId={trackingScanId}
                    isOpen={true}
                    onClose={() => setTrackingScanId(null)}
                />
            )}
        </>
    );

    return (
        <>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <div
                className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            />
            <div className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 transition-all">
                <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                    <h2 className="text-lg font-semibold text-slate-900">新建扫描任务</h2>
                    <button
                        onClick={onClose}
                        className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        void form.handleSubmit();
                    }}
                    className="p-6"
                >
                    <div className="space-y-5">
                        <div>
                            <label className="mb-1.5 block text-sm font-medium text-slate-700">
                                目标 URL
                            </label>
                            <form.Field
                                name="targetUrl"
                                validators={{
                                    onChange: ({ value }) =>
                                        value && value.startsWith('http')
                                            ? undefined
                                            : '请输入合法的 URL（包含 http/https）',
                                }}
                            >
                                {(field) => (
                                    <>
                                        <input
                                            type="url"
                                            value={field.state.value}
                                            onChange={(event) =>
                                                field.handleChange(event.target.value)
                                            }
                                            placeholder="https://example.com"
                                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm transition-all focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                            autoFocus
                                        />
                                        {field.state.meta.errors[0] ? (
                                            <p className="mt-1.5 text-xs font-medium text-rose-600">
                                                {field.state.meta.errors[0]}
                                            </p>
                                        ) : null}
                                    </>
                                )}
                            </form.Field>
                        </div>

                        <div>
                            <label className="mb-2 block text-sm font-medium text-slate-700">扫描模式</label>
                            <div className="grid grid-cols-2 gap-3">
                                {(['single', 'site'] as const).map((mode) => (
                                    <button
                                        type="button"
                                        key={mode}
                                        onClick={() => form.setFieldValue('mode', mode)}
                                        className={cn(
                                            'flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium transition-all',
                                            modeValue === mode
                                                ? 'border-indigo-500 bg-indigo-50 text-indigo-700 ring-1 ring-indigo-500'
                                                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                                        )}
                                    >
                                        {mode === 'single' ? <FileText className="h-4 w-4" /> : <Globe className="h-4 w-4" />}
                                        {mode === 'single' ? '单页扫描' : '整站爬取'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="rounded-xl border border-slate-200 bg-slate-50/50">
                            <button
                                type="button"
                                onClick={() => setShowAdvanced((prev) => !prev)}
                                className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-slate-600 hover:text-slate-900"
                            >
                                <span className="flex items-center gap-2">
                                    <Settings2 className="h-4 w-4" />
                                    高级设置
                                </span>
                                <span className="text-xs text-slate-400">{showAdvanced ? '收起' : '展开'}</span>
                            </button>

                            {showAdvanced && (
                                <div className="border-t border-slate-200 px-4 py-4">
                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <form.Field name="options.siteDepth">
                                            {(field) => (
                                                <label className="block space-y-1.5">
                                                    <span className="text-xs font-medium text-slate-600">整站深度</span>
                                                    <input
                                                        type="number"
                                                        min={1}
                                                        max={10}
                                                        value={field.state.value ?? 1}
                                                        onChange={(e) => field.handleChange((e.target.valueAsNumber || undefined) as any)}
                                                        disabled={modeValue === 'single'}
                                                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:opacity-50"
                                                    />
                                                </label>
                                            )}
                                        </form.Field>
                                        <form.Field name="options.maxPages">
                                            {(field) => (
                                                <label className="block space-y-1.5">
                                                    <span className="text-xs font-medium text-slate-600">最大页数</span>
                                                    <input
                                                        type="number"
                                                        min={1}
                                                        max={500}
                                                        value={field.state.value ?? 150}
                                                        onChange={(e) => field.handleChange((e.target.valueAsNumber || undefined) as any)}
                                                        disabled={modeValue === 'single'}
                                                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:opacity-50"
                                                    />
                                                </label>
                                            )}
                                        </form.Field>
                                    </div>

                                    <div className="mt-4 space-y-4">
                                        <form.Field name="options.userAgent">
                                            {(field) => (
                                                <label className="block space-y-1.5">
                                                    <span className="text-xs font-medium text-slate-600">User-Agent</span>
                                                    <input
                                                        type="text"
                                                        value={field.state.value ?? ''}
                                                        onChange={(e) => field.handleChange(e.target.value)}
                                                        placeholder="默认 UA"
                                                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                                                    />
                                                </label>
                                            )}
                                        </form.Field>
                                        <form.Field name="options.requestTimeoutMs">
                                            {(field) => (
                                                <label className="block space-y-1.5">
                                                    <span className="text-xs font-medium text-slate-600">请求超时 (ms)</span>
                                                    <input
                                                        type="number"
                                                        min={2000}
                                                        max={60000}
                                                        value={field.state.value ?? 15000}
                                                        onChange={(e) => field.handleChange((e.target.valueAsNumber || undefined) as any)}
                                                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                                                    />
                                                </label>
                                            )}
                                        </form.Field>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="pt-2">
                            <button
                                type="submit"
                                disabled={!canSubmit || createMutation.isPending}
                                className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-200 transition-all hover:bg-indigo-700 hover:shadow-indigo-300 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
                            >
                                {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                                {createMutation.isPending ? '正在创建任务...' : '开始扫描'}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
        {trackingScanId && (
            <ScanTrackingModal
                scanId={trackingScanId}
                isOpen={true}
                onClose={() => setTrackingScanId(null)}
            />
        )}
    </>
    );
}
