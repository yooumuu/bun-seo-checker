import { Link } from '@tanstack/react-router';
import type { ScanIssuesSummary, ScanJob } from '@shared/types';
import { formatDateTime, cn } from '@/lib/utils';
import { StatusBadge } from '@/components/scan-badges';
import { ChevronRight, Globe, FileText, Calendar } from 'lucide-react';

interface ScanCardProps {
    job: ScanJob;
}

export function ScanCard({ job }: ScanCardProps) {
    const summary = job.issuesSummary as ScanIssuesSummary | null;

    return (
        <Link
            to="/history/$scanId"
            params={{ scanId: job.id.toString() }}
            className="group relative flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 transition-all hover:border-indigo-200 hover:shadow-lg hover:shadow-indigo-500/5"
        >
            <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3 overflow-hidden">
                    <div className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                        job.mode === 'site' ? "bg-indigo-50 text-indigo-600" : "bg-emerald-50 text-emerald-600"
                    )}>
                        {job.mode === 'site' ? <Globe className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
                    </div>
                    <div className="flex flex-col overflow-hidden">
                        <h3 className="truncate text-sm font-semibold text-foreground group-hover:text-indigo-600 transition-colors">
                            {job.targetUrl}
                        </h3>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            <span>{formatDateTime(job.createdAt)}</span>
                        </div>
                    </div>
                </div>
                <StatusBadge status={job.status} />
            </div>

            <div className="grid grid-cols-2 gap-4 border-t border-border pt-4">
                <div className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-muted-foreground">扫描进度</span>
                    <div className="flex items-baseline gap-1">
                        <span className="text-lg font-semibold text-foreground">{job.pagesFinished}</span>
                        <span className="text-xs text-muted-foreground">/ {job.pagesTotal ?? '-'} 页</span>
                    </div>
                </div>

                {summary ? (
                    <div className="flex flex-col gap-1">
                        <span className="text-xs font-medium text-muted-foreground">健康度</span>
                        <div className="flex items-center gap-2">
                            <span className={cn(
                                "text-lg font-semibold",
                                summary.scorecard.overallHealthPercent >= 90 ? "text-emerald-600" :
                                    summary.scorecard.overallHealthPercent >= 70 ? "text-amber-600" : "text-rose-600"
                            )}>
                                {summary.scorecard.overallHealthPercent}%
                            </span>
                            <div className="h-1.5 flex-1 rounded-full bg-slate-100">
                                <div
                                    className={cn(
                                        "h-full rounded-full transition-all",
                                        summary.scorecard.overallHealthPercent >= 90 ? "bg-emerald-500" :
                                            summary.scorecard.overallHealthPercent >= 70 ? "bg-amber-500" : "bg-rose-500"
                                    )}
                                    style={{ width: `${summary.scorecard.overallHealthPercent}%` }}
                                />
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col gap-1">
                        <span className="text-xs font-medium text-muted-foreground">状态</span>
                        <span className="text-sm text-muted-foreground">等待结果...</span>
                    </div>
                )}
            </div>

            <div className="absolute right-5 top-1/2 -translate-y-1/2 opacity-0 transition-all group-hover:translate-x-1 group-hover:opacity-100">
                <ChevronRight className="h-5 w-5 text-indigo-400" />
            </div>
        </Link>
    );
}
