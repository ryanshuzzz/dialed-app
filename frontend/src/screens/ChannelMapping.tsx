import { useState, useMemo, useCallback, useRef } from 'react';
import { ArrowLeft, Search, Upload, Check, AlertTriangle, Trash2, X, ChevronDown } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  useChannelAliases,
  useCreateChannelAlias,
  useUpdateChannelAlias,
  useDeleteChannelAlias,
} from '@/hooks/useAdmin';
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton';
import { ErrorState } from '@/components/common/ErrorState';
import { cn } from '@/lib/utils';
import type { ChannelAlias } from '@/api/types';

// ─── Core Channel Definitions ──────────────────────────────────────────────────

interface CoreChannel {
  canonical: string;
  label: string;
  description: string;
  unit: string;
}

const CORE_CHANNELS: CoreChannel[] = [
  { canonical: 'gps_speed', label: 'GPS Speed', description: 'Vehicle speed from GPS receiver', unit: 'mph or km/h' },
  { canonical: 'throttle_pos', label: 'Throttle Position', description: 'Throttle opening percentage', unit: '%' },
  { canonical: 'rpm', label: 'Engine RPM', description: 'Engine revolutions per minute', unit: 'rpm' },
  { canonical: 'gear', label: 'Gear', description: 'Current gear position', unit: '1-6' },
  { canonical: 'lean_angle', label: 'Lean Angle', description: 'Motorcycle bank/lean angle', unit: 'degrees' },
  { canonical: 'front_brake_psi', label: 'Front Brake PSI', description: 'Front brake line pressure', unit: 'psi or bar' },
  { canonical: 'rear_brake_psi', label: 'Rear Brake PSI', description: 'Rear brake line pressure', unit: 'psi or bar' },
  { canonical: 'fork_position', label: 'Fork Position', description: 'Front fork travel / potentiometer', unit: 'mm' },
  { canonical: 'shock_position', label: 'Shock Position', description: 'Rear shock travel / potentiometer', unit: 'mm' },
  { canonical: 'coolant_temp', label: 'Coolant Temp', description: 'Engine coolant temperature', unit: '°C or °F' },
  { canonical: 'oil_temp', label: 'Oil Temp', description: 'Engine oil temperature', unit: '°C or °F' },
  { canonical: 'lat', label: 'Latitude', description: 'GPS latitude coordinate', unit: 'decimal degrees' },
  { canonical: 'lon', label: 'Longitude', description: 'GPS longitude coordinate', unit: 'decimal degrees' },
];

// ─── Logger Profiles (Presets) ─────────────────────────────────────────────────

interface LoggerProfile {
  id: string;
  label: string;
  loggerModel: string;
  mappings: Record<string, string>; // canonical_name → raw_name
}

const LOGGER_PROFILES: LoggerProfile[] = [
  {
    id: 'aim-solo2',
    label: 'AiM Solo 2 DL',
    loggerModel: 'AiM Solo 2 DL',
    mappings: {
      gps_speed: 'GPS Speed',
      throttle_pos: 'ThrottlePosition',
      rpm: 'Engine RPM',
      gear: 'Gear Postion',
      lean_angle: 'Bank Angle',
      front_brake_psi: 'Front brake',
      fork_position: 'FR Potentiometer',
      coolant_temp: 'Coolant Temp',
      lat: 'GPS Latitude',
      lon: 'GPS Longitude',
    },
  },
  {
    id: 'racecapture',
    label: 'RaceCapture Pro',
    loggerModel: 'RaceCapture Pro',
    mappings: {
      gps_speed: 'Speed',
      throttle_pos: 'TPS',
      rpm: 'RPM',
      gear: 'Gear',
      lean_angle: 'LeanAngle',
      lat: 'Latitude',
      lon: 'Longitude',
    },
  },
  {
    id: 'custom',
    label: 'Custom',
    loggerModel: '',
    mappings: {},
  },
];

// ─── CSV Test Result Types ─────────────────────────────────────────────────────

interface CsvTestResult {
  csvColumns: string[];
  matched: { canonical: string; rawName: string }[];
  unmatched: string[]; // canonical names with no match
  unmappedCsvCols: string[]; // csv columns that don't match any mapping
}

// ─── Toast Component ───────────────────────────────────────────────────────────

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="flex items-center gap-2 rounded-lg border border-accent-green/30 bg-accent-green/10 px-4 py-2.5 shadow-lg backdrop-blur">
        <Check className="h-4 w-4 text-accent-green" />
        <span className="text-sm font-medium text-accent-green">{message}</span>
        <button onClick={onClose} className="ml-2 text-accent-green/60 hover:text-accent-green">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function ChannelMapping() {
  const { data: aliases, isLoading, isError, refetch } = useChannelAliases();
  const createAlias = useCreateChannelAlias();
  const updateAlias = useUpdateChannelAlias();
  const deleteAlias = useDeleteChannelAlias();

  const [selectedProfileId, setSelectedProfileId] = useState<string>('aim-solo2');
  const [draftMappings, setDraftMappings] = useState<Record<string, string>>({});
  const [searchFilter, setSearchFilter] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const [csvTestResult, setCsvTestResult] = useState<CsvTestResult | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedProfile = LOGGER_PROFILES.find((p) => p.id === selectedProfileId) ?? LOGGER_PROFILES[0];

  // Build effective mappings: existing aliases for the selected logger + draft overrides
  const existingMappingsByCanonical = useMemo(() => {
    const map: Record<string, ChannelAlias> = {};
    if (!aliases) return map;
    for (const alias of aliases) {
      if (
        !selectedProfile.loggerModel ||
        alias.logger_model === selectedProfile.loggerModel ||
        !alias.logger_model
      ) {
        map[alias.canonical_name] = alias;
      }
    }
    return map;
  }, [aliases, selectedProfile.loggerModel]);

  const getEffectiveRawName = useCallback(
    (canonical: string): string => {
      if (draftMappings[canonical] !== undefined) return draftMappings[canonical];
      if (existingMappingsByCanonical[canonical]) return existingMappingsByCanonical[canonical].raw_name;
      return selectedProfile.mappings[canonical] ?? '';
    },
    [draftMappings, existingMappingsByCanonical, selectedProfile.mappings],
  );

  // Filter aliases for the left panel grouped view
  const filteredAliases = useMemo(() => {
    if (!aliases) return [];
    const lowerSearch = searchFilter.toLowerCase();
    return aliases.filter(
      (a) =>
        a.raw_name.toLowerCase().includes(lowerSearch) ||
        a.canonical_name.toLowerCase().includes(lowerSearch) ||
        (a.logger_model ?? '').toLowerCase().includes(lowerSearch),
    );
  }, [aliases, searchFilter]);

  const aliasesByModel = useMemo(() => {
    const groups: Record<string, ChannelAlias[]> = {};
    for (const alias of filteredAliases) {
      const key = alias.logger_model || 'Unscoped';
      if (!groups[key]) groups[key] = [];
      groups[key].push(alias);
    }
    return groups;
  }, [filteredAliases]);

  // Count mapped channels
  const mappedCount = CORE_CHANNELS.filter((ch) => {
    const raw = getEffectiveRawName(ch.canonical);
    return raw.trim().length > 0;
  }).length;

  // ─── Handlers ──────────────────────────────────────────────────────────────

  function handleDraftChange(canonical: string, rawName: string) {
    setDraftMappings((prev) => ({ ...prev, [canonical]: rawName }));
  }

  function handleProfileChange(profileId: string) {
    setSelectedProfileId(profileId);
    setDraftMappings({});
    setCsvTestResult(null);
  }

  async function handleApplyProfile() {
    setIsApplying(true);
    try {
      const promises: Promise<unknown>[] = [];
      for (const ch of CORE_CHANNELS) {
        const rawName = getEffectiveRawName(ch.canonical);
        if (!rawName.trim()) continue;

        const existing = existingMappingsByCanonical[ch.canonical];
        if (existing) {
          // Update if different
          if (existing.raw_name !== rawName || existing.logger_model !== (selectedProfile.loggerModel || null)) {
            promises.push(
              new Promise((resolve, reject) =>
                updateAlias.mutate(
                  {
                    aliasId: existing.id,
                    data: {
                      raw_name: rawName,
                      logger_model: selectedProfile.loggerModel || null,
                    },
                  },
                  { onSuccess: resolve, onError: reject },
                ),
              ),
            );
          }
        } else {
          promises.push(
            new Promise((resolve, reject) =>
              createAlias.mutate(
                {
                  raw_name: rawName,
                  canonical_name: ch.canonical,
                  logger_model: selectedProfile.loggerModel || null,
                },
                { onSuccess: resolve, onError: reject },
              ),
            ),
          );
        }
      }
      await Promise.all(promises);
      setDraftMappings({});
      showToast(`${selectedProfile.label} profile applied — ${mappedCount} channels mapped`);
    } catch {
      showToast('Error applying profile. Please try again.');
    } finally {
      setIsApplying(false);
    }
  }

  async function handleDeleteAlias(aliasId: string) {
    deleteAlias.mutate(aliasId, {
      onSuccess: () => {
        setDeleteConfirmId(null);
        showToast('Mapping deleted');
      },
    });
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  function handleCsvTest(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const firstLine = text.split('\n')[0];
      if (!firstLine) return;

      // Parse CSV header — handle quoted columns
      const csvColumns = firstLine
        .split(',')
        .map((col) => col.trim().replace(/^["']|["']$/g, ''));

      const matched: CsvTestResult['matched'] = [];
      const unmatched: string[] = [];
      const matchedCsvCols = new Set<string>();

      for (const ch of CORE_CHANNELS) {
        const rawName = getEffectiveRawName(ch.canonical);
        if (rawName && csvColumns.some((col) => col.toLowerCase() === rawName.toLowerCase())) {
          matched.push({ canonical: ch.canonical, rawName });
          matchedCsvCols.add(rawName.toLowerCase());
        } else {
          unmatched.push(ch.canonical);
        }
      }

      const unmappedCsvCols = csvColumns.filter(
        (col) => !matchedCsvCols.has(col.toLowerCase()),
      );

      setCsvTestResult({ csvColumns, matched, unmatched, unmappedCsvCols });
    };
    reader.readAsText(file.slice(0, 4096)); // Only need the header
    // Reset input so same file can be re-selected
    e.target.value = '';
  }

  // ─── Loading / Error States ────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <Header />
        <main className="mx-auto max-w-7xl px-4 py-6">
          <LoadingSkeleton variant="lines" count={8} />
        </main>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <Header />
        <main className="mx-auto max-w-7xl px-4 py-6">
          <ErrorState message="Failed to load channel aliases." onRetry={() => refetch()} />
        </main>
      </div>
    );
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background pb-24">
      <Header />

      <main className="mx-auto max-w-7xl px-4 py-6">
        {/* Summary bar */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm text-foreground-secondary">
              <span className="font-mono font-semibold text-accent-orange">{mappedCount}</span>
              <span className="text-foreground-muted">/{CORE_CHANNELS.length}</span> channels mapped
            </span>
            {mappedCount === CORE_CHANNELS.length && (
              <span className="flex items-center gap-1 rounded-full bg-accent-green/10 px-2.5 py-0.5 text-xs font-medium text-accent-green">
                <Check className="h-3 w-3" /> All mapped
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 rounded-lg border border-border-subtle px-3 py-2 text-sm font-medium text-foreground-secondary transition-colors hover:bg-background-elevated hover:text-foreground"
            >
              <Upload className="h-4 w-4" />
              Test with CSV
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleCsvTest}
            />
            <button
              onClick={handleApplyProfile}
              disabled={isApplying}
              className="rounded-lg bg-accent-orange px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-orange-hover disabled:opacity-50"
            >
              {isApplying ? 'Applying…' : `Apply ${selectedProfile.label} Profile`}
            </button>
          </div>
        </div>

        {/* CSV Test Results */}
        {csvTestResult && (
          <CsvTestResults result={csvTestResult} onClose={() => setCsvTestResult(null)} />
        )}

        {/* Desktop: Two-panel / Mobile: Stacked */}
        <div className="flex flex-col gap-6 lg:flex-row">
          {/* Left Panel: Logger Selector + Existing Mappings */}
          <div className="w-full lg:w-[40%]">
            {/* Logger Profile Selector */}
            <div className="mb-4 rounded-lg border border-border-subtle bg-background-surface p-4">
              <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-foreground-muted">
                Logger Profile
              </label>
              <div className="relative">
                <select
                  value={selectedProfileId}
                  onChange={(e) => handleProfileChange(e.target.value)}
                  className="w-full appearance-none rounded-lg border border-border-subtle bg-background-elevated px-3 py-2.5 pr-10 text-sm font-medium text-foreground focus:border-accent-orange focus:outline-none"
                >
                  {LOGGER_PROFILES.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-muted" />
              </div>
            </div>

            {/* Search */}
            <div className="mb-4 relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-muted" />
              <input
                type="text"
                placeholder="Search mappings…"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="w-full rounded-lg border border-border-subtle bg-background-surface pl-10 pr-3 py-2.5 text-sm text-foreground placeholder:text-foreground-muted focus:border-accent-orange focus:outline-none"
              />
            </div>

            {/* Current Mappings grouped by logger model */}
            <div className="space-y-3">
              {Object.keys(aliasesByModel).length === 0 ? (
                <div className="rounded-lg border border-border-subtle bg-background-surface p-6 text-center">
                  <p className="text-sm text-foreground-muted">
                    No saved mappings yet. Select a profile and click Apply.
                  </p>
                </div>
              ) : (
                Object.entries(aliasesByModel).map(([model, modelAliases]) => (
                  <div key={model} className="rounded-lg border border-border-subtle bg-background-surface">
                    <div className="border-b border-border-subtle px-4 py-2.5">
                      <h3 className="text-xs font-medium uppercase tracking-wider text-foreground-muted">
                        {model}
                      </h3>
                    </div>
                    <div className="divide-y divide-border-subtle">
                      {modelAliases.map((alias) => (
                        <div
                          key={alias.id}
                          className="flex items-center justify-between px-4 py-2.5 hover:bg-background-elevated"
                        >
                          <div className="min-w-0 flex-1">
                            <span className="text-sm font-mono text-foreground">{alias.raw_name}</span>
                            <span className="mx-2 text-foreground-muted">→</span>
                            <span className="text-sm font-mono text-accent-orange">{alias.canonical_name}</span>
                          </div>
                          <div className="ml-2 flex-shrink-0">
                            {deleteConfirmId === alias.id ? (
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => handleDeleteAlias(alias.id)}
                                  className="min-h-[36px] rounded px-2 text-xs font-medium text-red-500 hover:bg-red-500/10"
                                >
                                  Confirm
                                </button>
                                <button
                                  onClick={() => setDeleteConfirmId(null)}
                                  className="min-h-[36px] rounded px-2 text-xs text-foreground-muted hover:bg-background-elevated"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setDeleteConfirmId(alias.id)}
                                className="min-h-[36px] flex items-center rounded p-1.5 text-foreground-muted hover:bg-red-500/10 hover:text-red-500"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right Panel: Core Channel Mapping Cards */}
          <div className="w-full lg:w-[60%]">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xs font-medium uppercase tracking-wider text-foreground-muted">
                Core Channels
              </h2>
              <span className="text-xs text-foreground-muted">
                {CORE_CHANNELS.length} channels
              </span>
            </div>
            <div className="space-y-2">
              {CORE_CHANNELS.map((ch) => {
                const rawName = getEffectiveRawName(ch.canonical);
                const isMapped = rawName.trim().length > 0;
                const isDraft = draftMappings[ch.canonical] !== undefined;

                return (
                  <div
                    key={ch.canonical}
                    className={cn(
                      'rounded-lg border bg-background-surface p-4 transition-colors',
                      isMapped ? 'border-accent-green/20' : 'border-border-subtle',
                    )}
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                      {/* Status + Info */}
                      <div className="flex items-start gap-3 sm:w-[45%]">
                        <div className="mt-0.5 flex-shrink-0">
                          {isMapped ? (
                            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-accent-green/10">
                              <Check className="h-3.5 w-3.5 text-accent-green" />
                            </div>
                          ) : (
                            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-accent-yellow/10">
                              <AlertTriangle className="h-3.5 w-3.5 text-accent-yellow" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-foreground">{ch.label}</span>
                            <span className="rounded bg-background-elevated px-1.5 py-0.5 font-mono text-[10px] text-foreground-muted">
                              {ch.canonical}
                            </span>
                          </div>
                          <p className="text-xs text-foreground-muted">{ch.description}</p>
                          <p className="text-[10px] text-foreground-muted/60">Unit: {ch.unit}</p>
                        </div>
                      </div>

                      {/* Input */}
                      <div className="flex-1 sm:w-[55%]">
                        <div className="relative">
                          <input
                            type="text"
                            placeholder="CSV column name…"
                            value={rawName}
                            onChange={(e) => handleDraftChange(ch.canonical, e.target.value)}
                            className={cn(
                              'w-full rounded-lg border bg-background-elevated px-3 py-2 font-mono text-sm text-foreground placeholder:text-foreground-muted/50 focus:outline-none',
                              isDraft
                                ? 'border-accent-orange focus:border-accent-orange'
                                : 'border-border-subtle focus:border-accent-orange',
                            )}
                          />
                          {isDraft && (
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 rounded bg-accent-orange/10 px-1.5 py-0.5 text-[10px] font-medium text-accent-orange">
                              draft
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Mobile: Bottom Apply button */}
            <div className="mt-6 lg:hidden">
              <button
                onClick={handleApplyProfile}
                disabled={isApplying}
                className="w-full rounded-lg bg-accent-orange px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-accent-orange-hover disabled:opacity-50"
              >
                {isApplying ? 'Applying…' : `Apply ${selectedProfile.label} Profile`}
              </button>
            </div>
          </div>
        </div>
      </main>

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  );
}

// ─── Header ────────────────────────────────────────────────────────────────────

function Header() {
  return (
    <header className="border-b border-border-subtle bg-background safe-area-top">
      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="flex items-center gap-3">
          <Link
            to="/settings"
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-background-surface transition-colors hover:bg-background-elevated"
          >
            <ArrowLeft className="h-4 w-4 text-foreground-secondary" />
          </Link>
          <div>
            <h1 className="font-mono text-2xl font-semibold text-foreground">Channel Mapping</h1>
            <p className="text-xs text-foreground-muted">Map data logger columns to Dialed channels</p>
          </div>
        </div>
      </div>
    </header>
  );
}

// ─── CSV Test Results Panel ────────────────────────────────────────────────────

function CsvTestResults({ result, onClose }: { result: CsvTestResult; onClose: () => void }) {
  return (
    <div className="mb-6 rounded-lg border border-border-subtle bg-background-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">
          CSV Test Results — {result.csvColumns.length} columns found
        </h3>
        <button onClick={onClose} className="text-foreground-muted hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Matched */}
        <div>
          <h4 className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-accent-green">
            <Check className="h-3.5 w-3.5" />
            Matched ({result.matched.length})
          </h4>
          <div className="space-y-1">
            {result.matched.map((m) => (
              <div key={m.canonical} className="flex items-center gap-2 rounded bg-accent-green/5 px-2.5 py-1.5">
                <span className="font-mono text-xs text-foreground">{m.rawName}</span>
                <span className="text-foreground-muted">→</span>
                <span className="font-mono text-xs text-accent-green">{m.canonical}</span>
              </div>
            ))}
            {result.matched.length === 0 && (
              <p className="text-xs text-foreground-muted">No channels matched</p>
            )}
          </div>
        </div>

        {/* Unmatched */}
        <div>
          <h4 className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-accent-yellow">
            <AlertTriangle className="h-3.5 w-3.5" />
            Unmatched Channels ({result.unmatched.length})
          </h4>
          <div className="space-y-1">
            {result.unmatched.map((canonical) => (
              <div key={canonical} className="rounded bg-accent-yellow/5 px-2.5 py-1.5">
                <span className="font-mono text-xs text-accent-yellow">{canonical}</span>
              </div>
            ))}
            {result.unmatched.length === 0 && (
              <p className="text-xs text-foreground-muted">All channels matched!</p>
            )}
          </div>

          {result.unmappedCsvCols.length > 0 && (
            <>
              <h4 className="mb-2 mt-4 text-xs font-medium uppercase tracking-wider text-foreground-muted">
                Unmapped CSV Columns ({result.unmappedCsvCols.length})
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {result.unmappedCsvCols.map((col) => (
                  <span
                    key={col}
                    className="rounded bg-background-elevated px-2 py-1 font-mono text-[10px] text-foreground-muted"
                  >
                    {col}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
