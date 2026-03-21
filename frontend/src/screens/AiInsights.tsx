import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, ChevronRight, TrendingDown, Zap, Wrench, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiGet, ApiError } from '@/api/client';

const insights = [
  {
    id: 1,
    type: 'opportunity',
    title: 'ECU opportunity detected',
    description: 'GRPPCT Mode 2 is capping throttle body at 57%. Potential 2-3s improvement.',
    bike: '2021 Honda CBR1000RR-R SP',
    icon: Zap,
    color: 'accent-orange' as const,
  },
  {
    id: 2,
    type: 'trend',
    title: 'Front rebound adjustments working',
    description: 'Your last 3 rebound changes have averaged 0.4s improvement per session.',
    bike: '2021 Honda CBR1000RR-R SP',
    icon: TrendingDown,
    color: 'accent-green' as const,
  },
  {
    id: 3,
    type: 'suggestion',
    title: 'Consider rear preload adjustment',
    description: 'Free sag measurement trending high. May affect weight transfer on braking.',
    bike: '2021 Honda CBR1000RR-R SP',
    icon: Wrench,
    color: 'accent-yellow' as const,
  },
];

const recentSuggestions = [
  {
    id: 'qp6',
    session: 'QP6 Qualifying',
    date: 'Sat Mar 7',
    setting: 'Front rebound 14 \u2192 12',
    status: 'applied' as const,
    result: '-0.4s',
  },
  {
    id: 'qp5',
    session: 'QP5 Qualifying',
    date: 'Sat Mar 7',
    setting: 'Rear preload 8 \u2192 10',
    status: 'pending' as const,
    result: undefined,
  },
  {
    id: 'p3',
    session: 'P3 Practice',
    date: 'Fri Mar 6',
    setting: 'Front compression 14 \u2192 16',
    status: 'applied' as const,
    result: '-0.2s',
  },
];

export default function AiInsights() {
  const [aiUnavailable, setAiUnavailable] = useState(false)

  useEffect(() => {
    // Check if the AI suggest endpoint is available
    apiGet('/suggest/health')
      .then(() => setAiUnavailable(false))
      .catch((err) => {
        if (
          err instanceof ApiError &&
          (err.status === 503 || err.code === 'SERVICE_UNAVAILABLE')
        ) {
          setAiUnavailable(true)
        }
      })
  }, [])

  if (aiUnavailable) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <header className="border-b border-border-subtle bg-background safe-area-top">
          <div className="mx-auto max-w-[480px] px-4 py-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-orange/20">
                <Sparkles className="h-5 w-5 text-accent-orange" />
              </div>
              <div>
                <h1 className="font-mono text-2xl font-semibold text-foreground">AI Insights</h1>
                <p className="text-sm text-foreground-secondary">
                  Personalized recommendations
                </p>
              </div>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-[480px] px-4 py-12">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-foreground-muted/10">
              <AlertCircle className="h-8 w-8 text-foreground-muted" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">
              AI suggestions aren't configured yet
            </h2>
            <p className="max-w-sm text-sm text-foreground-secondary">
              An API key for the AI service hasn't been set up. Once configured, you'll get
              personalized suspension recommendations based on your session data.
            </p>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="border-b border-border-subtle bg-background safe-area-top">
        <div className="mx-auto max-w-[480px] px-4 py-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-orange/20">
              <Sparkles className="h-5 w-5 text-accent-orange" />
            </div>
            <div>
              <h1 className="font-mono text-2xl font-semibold text-foreground">AI Insights</h1>
              <p className="text-sm text-foreground-secondary">
                Personalized recommendations
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[480px] px-4 py-6">
        <div className="flex flex-col gap-6">
          {/* Active Insights */}
          <section>
            <h2 className="mb-3 text-sm font-medium text-foreground-secondary">Active Insights</h2>
            <div className="flex flex-col gap-3">
              {insights.map((insight) => {
                const Icon = insight.icon;
                return (
                  <div
                    key={insight.id}
                    className={cn(
                      'rounded-lg border bg-background-surface p-4',
                      insight.color === 'accent-orange' && 'border-accent-orange/30',
                      insight.color === 'accent-green' && 'border-accent-green/30',
                      insight.color === 'accent-yellow' && 'border-accent-yellow/30'
                    )}
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <Icon className={cn(
                        'h-4 w-4',
                        insight.color === 'accent-orange' && 'text-accent-orange',
                        insight.color === 'accent-green' && 'text-accent-green',
                        insight.color === 'accent-yellow' && 'text-accent-yellow'
                      )} />
                      <span className="font-medium text-foreground">{insight.title}</span>
                    </div>
                    <p className="text-sm text-foreground-secondary">{insight.description}</p>
                    <p className="mt-2 text-xs text-foreground-muted">{insight.bike}</p>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Recent Suggestions */}
          <section>
            <h2 className="mb-3 text-sm font-medium text-foreground-secondary">Recent Suggestions</h2>
            <div className="flex flex-col gap-2">
              {recentSuggestions.map((suggestion) => (
                <Link key={suggestion.id} to={`/sessions/${suggestion.id}`}>
                  <div className="flex items-center justify-between rounded-lg border border-border-subtle bg-background-surface p-3 transition-colors hover:border-border">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">
                          {suggestion.setting}
                        </span>
                        <span className={cn(
                          'rounded-full px-2 py-0.5 text-[10px] font-medium uppercase',
                          suggestion.status === 'applied'
                            ? 'bg-accent-green/20 text-accent-green'
                            : 'bg-foreground-muted/20 text-foreground-muted'
                        )}>
                          {suggestion.status}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-foreground-muted">
                        {suggestion.session} &middot; {suggestion.date}
                      </p>
                    </div>
                    {suggestion.result && (
                      <span className="font-mono text-sm font-medium tabular-nums text-accent-green">
                        {suggestion.result}
                      </span>
                    )}
                    <ChevronRight className="ml-2 h-4 w-4 text-foreground-muted" />
                  </div>
                </Link>
              ))}
            </div>
          </section>

          {/* Stats */}
          <section className="rounded-lg border border-border-subtle bg-background-surface p-4">
            <h2 className="mb-4 text-sm font-medium text-foreground-secondary">AI Performance</h2>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <span className="block font-mono text-2xl font-semibold tabular-nums text-foreground">67%</span>
                <span className="text-xs text-foreground-muted">Accuracy</span>
              </div>
              <div>
                <span className="block font-mono text-2xl font-semibold tabular-nums text-accent-green">6</span>
                <span className="text-xs text-foreground-muted">Applied</span>
              </div>
              <div>
                <span className="flex items-center justify-center gap-1">
                  <TrendingDown className="h-4 w-4 text-accent-green" />
                  <span className="font-mono text-2xl font-semibold tabular-nums text-accent-green">4.0s</span>
                </span>
                <span className="text-xs text-foreground-muted">Found</span>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
