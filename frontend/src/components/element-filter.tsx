import { useState } from 'react';
import { Filter,  Eye, EyeOff, ChevronDown } from 'lucide-react';

export interface FilterableElement {
  selector: string;
  label: string;
  category: 'layout' | 'content' | 'navigation';
  count: number;
}

export interface ElementFilterProps {
  elements: FilterableElement[];
  onFilterChange: (hiddenSelectors: Set<string>) => void;
}

export function ElementFilter({ elements, onFilterChange }: ElementFilterProps) {
  const [hiddenSelectors, setHiddenSelectors] = useState<Set<string>>(new Set());
  const [isExpanded, setIsExpanded] = useState(false);

  const categories = {
    layout: { label: '布局元素', color: 'blue' },
    navigation: { label: '导航元素', color: 'purple' },
    content: { label: '内容元素', color: 'emerald' },
  };

  const toggleSelector = (selector: string) => {
    const newHidden = new Set(hiddenSelectors);
    if (newHidden.has(selector)) {
      newHidden.delete(selector);
    } else {
      newHidden.add(selector);
    }
    setHiddenSelectors(newHidden);
    onFilterChange(newHidden);
  };

  const hideAll = () => {
    const allSelectors = new Set(elements.map(e => e.selector));
    setHiddenSelectors(allSelectors);
    onFilterChange(allSelectors);
  };

  const showAll = () => {
    setHiddenSelectors(new Set());
    onFilterChange(new Set());
  };

  const groupedElements = elements.reduce((acc, el) => {
    if (!acc[el.category]) acc[el.category] = [];
    acc[el.category].push(el);
    return acc;
  }, {} as Record<string, FilterableElement[]>);

  if (elements.length === 0) return null;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full border-b border-slate-100 px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-400" />
          <h2 className="font-semibold text-slate-900">元素筛选器</h2>
          {hiddenSelectors.size > 0 && (
            <span className="text-xs text-slate-500">
              (已隐藏 {hiddenSelectors.size} 个)
            </span>
          )}
        </div>
        <ChevronDown
          className={`h-5 w-5 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Content */}
      {isExpanded && (
        <div>
          <div className="p-6 space-y-6">
            {/* Quick Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={showAll}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                <Eye className="h-3.5 w-3.5" />
                全部显示
              </button>
              <button
                onClick={hideAll}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                <EyeOff className="h-3.5 w-3.5" />
                全部隐藏
              </button>
            </div>

          {/* Element Groups */}
          {Object.entries(groupedElements).map(([category, els]) => {
            const catInfo = categories[category as keyof typeof categories];
            const allHidden = els.every(el => hiddenSelectors.has(el.selector));
            const someHidden = els.some(el => hiddenSelectors.has(el.selector));

            return (
              <div key={category} className="space-y-2">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <h3 className={`text-sm font-semibold text-${catInfo.color}-700`}>
                      {catInfo.label}
                    </h3>
                    <span className="text-xs text-slate-500">
                      {els.length} 个
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      const newHidden = new Set(hiddenSelectors);
                      els.forEach(el => {
                        if (allHidden) {
                          newHidden.delete(el.selector);
                        } else {
                          newHidden.add(el.selector);
                        }
                      });
                      setHiddenSelectors(newHidden);
                      onFilterChange(newHidden);
                    }}
                    className="text-xs text-slate-600 hover:text-slate-900 font-medium"
                  >
                    {allHidden ? '全部显示' : someHidden ? '全部隐藏' : '全部隐藏'}
                  </button>
                </div>

                <div className="grid gap-2">
                  {els.map(el => {
                    const isHidden = hiddenSelectors.has(el.selector);
                    return (
                      <button
                        key={el.selector}
                        onClick={() => toggleSelector(el.selector)}
                        className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                          isHidden
                            ? 'border-slate-200 bg-slate-50'
                            : `border-${catInfo.color}-200 bg-${catInfo.color}-50`
                        }`}
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          {isHidden ? (
                            <EyeOff className="h-4 w-4 text-slate-400 shrink-0" />
                          ) : (
                            <Eye className={`h-4 w-4 text-${catInfo.color}-600 shrink-0`} />
                          )}
                          <div className="text-left min-w-0 flex-1">
                            <div className={`text-sm font-medium truncate ${
                              isHidden ? 'text-slate-500' : 'text-slate-900'
                            }`}>
                              {el.label}
                            </div>
                            <code className="text-xs text-slate-400 font-mono truncate block">
                              {el.selector}
                            </code>
                          </div>
                        </div>
                        <div className={`text-xs font-semibold ${
                          isHidden ? 'text-slate-400' : `text-${catInfo.color}-600`
                        }`}>
                          {el.count}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
          </div>
        </div>
      )}
    </section>
  );
}
