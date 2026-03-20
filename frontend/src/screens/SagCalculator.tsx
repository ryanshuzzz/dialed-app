import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, AlertTriangle, Check, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

function MotorcycleSilhouette() {
  return (
    <svg viewBox="0 0 200 100" className="h-32 w-full text-foreground-muted">
      {/* Simple motorcycle side view */}
      <ellipse cx="40" cy="70" rx="25" ry="25" fill="none" stroke="currentColor" strokeWidth="2" />
      <ellipse cx="160" cy="70" rx="25" ry="25" fill="none" stroke="currentColor" strokeWidth="2" />
      <path
        d="M40,45 L70,25 L130,25 L160,45"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M40,45 L50,55 L90,55 L110,45 L140,50 L160,45"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      {/* Measurement points */}
      <circle cx="100" cy="40" r="4" fill="#E8520A" />
      <line x1="100" y1="40" x2="100" y2="95" stroke="#E8520A" strokeWidth="1" strokeDasharray="4 2" />
    </svg>
  );
}

interface SagHistory {
  date: string;
  staticUnladen: number;
  staticWithRider: number;
  raceSag: number;
}

const sagHistory: SagHistory[] = [
  { date: 'Mar 7', staticUnladen: 615, staticWithRider: 596, raceSag: 587 },
  { date: 'Mar 6', staticUnladen: 615, staticWithRider: 598, raceSag: 589 },
  { date: 'Feb 22', staticUnladen: 615, staticWithRider: 600, raceSag: 590 },
];

export default function SagCalculator() {
  const [staticUnladen, setStaticUnladen] = useState('615');
  const [staticWithRider, setStaticWithRider] = useState('596');
  const [raceSag, setRaceSag] = useState('');

  const unladenValue = parseFloat(staticUnladen) || 0;
  const withRiderValue = parseFloat(staticWithRider) || 0;
  const raceSagValue = parseFloat(raceSag) || 0;

  const freeSag = unladenValue - withRiderValue;
  const calculatedRaceSag = raceSagValue ? unladenValue - raceSagValue : null;

  const freeSagTarget = { min: 5, max: 8 };
  const raceSagTarget = { min: 25, max: 28 };

  const getFreeSagStatus = () => {
    if (freeSag < freeSagTarget.min) return { status: 'low', color: 'text-accent-yellow', label: 'Too little' };
    if (freeSag > freeSagTarget.max) return { status: 'high', color: 'text-accent-yellow', label: 'Too much' };
    return { status: 'ok', color: 'text-accent-green', label: 'In range' };
  };

  const getRaceSagStatus = () => {
    if (!calculatedRaceSag) return { status: 'pending', color: 'text-foreground-muted', label: 'Not measured' };
    if (calculatedRaceSag < raceSagTarget.min) return { status: 'low', color: 'text-accent-yellow', label: 'Too little' };
    if (calculatedRaceSag > raceSagTarget.max) return { status: 'high', color: 'text-accent-yellow', label: 'Too much' };
    return { status: 'ok', color: 'text-accent-green', label: 'In range' };
  };

  const freeSagStatus = getFreeSagStatus();
  const raceSagStatus = getRaceSagStatus();

  const getPreloadRecommendation = () => {
    if (freeSag <= freeSagTarget.max) return null;
    const turnsNeeded = Math.ceil((freeSag - freeSagTarget.max) / 2);
    return {
      current: 8,
      recommended: 8 + turnsNeeded,
      turns: turnsNeeded,
    };
  };

  const preloadRecommendation = getPreloadRecommendation();

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border-subtle bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 safe-area-top">
        <div className="mx-auto max-w-[480px] px-4 py-4">
          <div className="flex items-center gap-3">
            <Link
              to="/settings"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground-secondary transition-colors hover:bg-background-elevated hover:text-foreground"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="font-medium text-foreground">Sag Calculator</h1>
              <span className="text-xs text-foreground-secondary">Suspension geometry</span>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[480px] px-4 py-6">
        <div className="flex flex-col gap-6">
          {/* Motorcycle Diagram */}
          <div className="rounded-lg border border-border-subtle bg-background-surface p-4">
            <MotorcycleSilhouette />
          </div>

          {/* Measurement Inputs */}
          <section className="flex flex-col gap-4">
            <div className="rounded-lg border border-border-subtle bg-background-surface p-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm text-foreground">Static (unladen)</span>
                  <p className="text-xs text-foreground-muted">Bike on stand, no rider</p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    inputMode="decimal"
                    value={staticUnladen}
                    onChange={(e) => setStaticUnladen(e.target.value)}
                    className="h-10 w-20 rounded-md border border-border-subtle bg-background-elevated px-2 text-right font-mono tabular-nums text-foreground focus:border-accent-orange focus:outline-none focus:ring-1 focus:ring-accent-orange"
                  />
                  <span className="text-sm text-foreground-muted">mm</span>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-border-subtle bg-background-surface p-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm text-foreground">Static (with rider)</span>
                  <p className="text-xs text-foreground-muted">Rider seated, feet up</p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    inputMode="decimal"
                    value={staticWithRider}
                    onChange={(e) => setStaticWithRider(e.target.value)}
                    className="h-10 w-20 rounded-md border border-border-subtle bg-background-elevated px-2 text-right font-mono tabular-nums text-foreground focus:border-accent-orange focus:outline-none focus:ring-1 focus:ring-accent-orange"
                  />
                  <span className="text-sm text-foreground-muted">mm</span>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-border-subtle bg-background-surface p-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm text-foreground">Race sag</span>
                  <p className="text-xs text-foreground-muted">In riding position</p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    inputMode="decimal"
                    value={raceSag}
                    onChange={(e) => setRaceSag(e.target.value)}
                    placeholder="\u2014"
                    className="h-10 w-20 rounded-md border border-border-subtle bg-background-elevated px-2 text-right font-mono tabular-nums text-foreground placeholder:text-foreground-muted focus:border-accent-orange focus:outline-none focus:ring-1 focus:ring-accent-orange"
                  />
                  <span className="text-sm text-foreground-muted">mm</span>
                </div>
              </div>
              {!raceSag && (
                <button
                  className="mt-3 w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm text-foreground transition-colors hover:bg-background-elevated"
                >
                  Measure now
                </button>
              )}
            </div>
          </section>

          {/* Calculated Results */}
          <section className="rounded-lg border border-border-subtle bg-background-surface p-4">
            <h3 className="mb-4 text-sm font-medium text-foreground-secondary">Calculated Results</h3>
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-foreground">Free sag</span>
                  {freeSagStatus.status === 'ok' ? (
                    <Check className="h-4 w-4 text-accent-green" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-accent-yellow" />
                  )}
                </div>
                <div className="text-right">
                  <span className="font-mono text-lg font-semibold tabular-nums text-foreground">
                    {freeSag} mm
                  </span>
                  <span className={cn('ml-2 text-xs', freeSagStatus.color)}>
                    {freeSagStatus.label}
                  </span>
                  <p className="text-xs text-foreground-muted">target {freeSagTarget.min}-{freeSagTarget.max} mm</p>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-foreground">Race sag</span>
                  {raceSagStatus.status === 'ok' ? (
                    <Check className="h-4 w-4 text-accent-green" />
                  ) : raceSagStatus.status === 'pending' ? (
                    <Minus className="h-4 w-4 text-foreground-muted" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-accent-yellow" />
                  )}
                </div>
                <div className="text-right">
                  <span className="font-mono text-lg font-semibold tabular-nums text-foreground">
                    {calculatedRaceSag ? `${calculatedRaceSag} mm` : '\u2014 mm'}
                  </span>
                  <span className={cn('ml-2 text-xs', raceSagStatus.color)}>
                    {raceSagStatus.label}
                  </span>
                  <p className="text-xs text-foreground-muted">target {raceSagTarget.min}-{raceSagTarget.max} mm</p>
                </div>
              </div>
            </div>
          </section>

          {/* Recommendation */}
          {preloadRecommendation && (
            <section className="rounded-lg border border-accent-orange/30 bg-accent-orange/10 p-4">
              <p className="text-sm text-foreground">
                Free sag is <span className="font-mono font-semibold">{freeSag}mm</span> &mdash; target is {freeSagTarget.min}-{freeSagTarget.max}mm.
              </p>
              <p className="mt-2 text-sm text-foreground-secondary">
                Add <span className="font-mono font-semibold text-foreground">{preloadRecommendation.turns} turns</span> of rear preload to bring sag into range.
              </p>
              <p className="mt-1 text-xs text-foreground-muted">
                (Current: {preloadRecommendation.current} turns &rarr; Recommended: {preloadRecommendation.recommended} turns)
              </p>
            </section>
          )}

          {/* History */}
          <section>
            <h3 className="mb-3 text-sm font-medium text-foreground-secondary">Measurement History</h3>
            <div className="rounded-lg border border-border-subtle bg-background-surface">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border-subtle text-left">
                    <th className="px-4 py-2 font-medium text-foreground-muted">Date</th>
                    <th className="px-4 py-2 text-right font-medium text-foreground-muted">Free</th>
                    <th className="px-4 py-2 text-right font-medium text-foreground-muted">Race</th>
                  </tr>
                </thead>
                <tbody>
                  {sagHistory.map((entry, i) => (
                    <tr key={i} className="border-b border-border-subtle last:border-b-0">
                      <td className="px-4 py-2 text-foreground-secondary">{entry.date}</td>
                      <td className="px-4 py-2 text-right font-mono tabular-nums text-foreground">
                        {entry.staticUnladen - entry.staticWithRider}
                      </td>
                      <td className="px-4 py-2 text-right font-mono tabular-nums text-foreground">
                        {entry.staticUnladen - entry.raceSag}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
