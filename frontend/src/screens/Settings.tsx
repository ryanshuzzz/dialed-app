import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ChevronRight, User, Gauge, Cpu, Ruler, Download, Info, LogOut } from 'lucide-react';
import {
  useProfile,
  useUpdateProfile,
  useApiKeys,
  useCreateApiKey,
  useDeleteApiKey,
} from '@/hooks/useAuth';
import { useAuthStore } from '@/stores/authStore';
import { useUiStore } from '@/stores/uiStore';
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton';
import { ErrorState } from '@/components/common/ErrorState';
import { cn } from '@/lib/utils';
import type { UserProfile } from '@/api/types';

export default function Settings() {
  const { data: profile, isLoading: profileLoading, isError: profileError, refetch: refetchProfile } = useProfile();
  const updateProfile = useUpdateProfile();
  const { data: apiKeys, isLoading: keysLoading } = useApiKeys();
  const createKey = useCreateApiKey();
  const deleteKey = useDeleteApiKey();
  const setRiderType = useUiStore((s) => s.setRiderType);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  // Local form state
  const [displayName, setDisplayName] = useState<string>('');
  const [riderType, setRiderTypeLocal] = useState<UserProfile['rider_type']>('street');
  const [skillLevel, setSkillLevel] = useState<UserProfile['skill_level']>('novice');
  const [units, setUnits] = useState<UserProfile['units']>('metric');
  const [profileInitialized, setProfileInitialized] = useState(false);

  // Editing state
  const [editingField, setEditingField] = useState<string | null>(null);

  // New API key form
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyExpires, setNewKeyExpires] = useState('');
  const [createdKeyRaw, setCreatedKeyRaw] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Sync form state from profile
  if (profile && !profileInitialized) {
    setDisplayName(profile.display_name ?? '');
    setRiderTypeLocal(profile.rider_type);
    setSkillLevel(profile.skill_level);
    setUnits(profile.units);
    setProfileInitialized(true);
  }

  function handleProfileSave() {
    updateProfile.mutate(
      {
        display_name: displayName || null,
        rider_type: riderType,
        skill_level: skillLevel,
        units,
      },
      {
        onSuccess: (updatedUser) => {
          setRiderType(updatedUser.rider_type);
          setEditingField(null);
        },
      },
    );
  }

  function handleCreateKey(e: React.FormEvent) {
    e.preventDefault();
    if (!newKeyName.trim()) return;
    createKey.mutate(
      {
        name: newKeyName.trim(),
        expires_at: newKeyExpires || null,
      },
      {
        onSuccess: (resp) => {
          setCreatedKeyRaw(resp.key);
          setNewKeyName('');
          setNewKeyExpires('');
        },
      },
    );
  }

  function handleDeleteKey(keyId: string) {
    deleteKey.mutate(keyId, {
      onSuccess: () => {
        setDeleteConfirmId(null);
      },
    });
  }

  function maskKey(id: string): string {
    return `dk_****${id.slice(-4)}`;
  }

  const skillLevelDisplay = skillLevel.charAt(0).toUpperCase() + skillLevel.slice(1);
  const unitsDisplay = units.charAt(0).toUpperCase() + units.slice(1);
  const riderTypeDisplay = riderType === 'casual_track' ? 'Casual Track' : riderType.charAt(0).toUpperCase() + riderType.slice(1);

  if (profileLoading) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <header className="border-b border-border-subtle bg-background safe-area-top">
          <div className="mx-auto max-w-[480px] px-4 py-6">
            <h1 className="font-mono text-2xl font-semibold text-foreground">Settings</h1>
          </div>
        </header>
        <main className="mx-auto max-w-[480px] px-4 py-6">
          <LoadingSkeleton variant="lines" count={5} />
        </main>
      </div>
    );
  }

  if (profileError) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <header className="border-b border-border-subtle bg-background safe-area-top">
          <div className="mx-auto max-w-[480px] px-4 py-6">
            <h1 className="font-mono text-2xl font-semibold text-foreground">Settings</h1>
          </div>
        </header>
        <main className="mx-auto max-w-[480px] px-4 py-6">
          <ErrorState message="Failed to load settings." onRetry={() => refetchProfile()} />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="border-b border-border-subtle bg-background safe-area-top">
        <div className="mx-auto max-w-[480px] px-4 py-6">
          <h1 className="font-mono text-2xl font-semibold text-foreground">Settings</h1>
        </div>
      </header>

      <main className="mx-auto max-w-[480px] px-4 py-6">
        <div className="flex flex-col gap-6">
          {/* Profile Section */}
          <section>
            <h2 className="mb-2 text-xs font-medium uppercase tracking-wider text-foreground-muted">
              Profile
            </h2>
            <div className="overflow-hidden rounded-lg border border-border-subtle bg-background-surface">
              {/* Display Name */}
              <div className="border-b border-border-subtle px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-background-elevated">
                    <User className="h-4 w-4 text-foreground-secondary" />
                  </div>
                  <div className="flex-1">
                    <span className="text-sm font-medium text-foreground">Display Name</span>
                  </div>
                  {editingField === 'name' ? (
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      onBlur={() => handleProfileSave()}
                      onKeyDown={(e) => e.key === 'Enter' && handleProfileSave()}
                      className="h-8 w-32 rounded-md border border-border-subtle bg-background-elevated px-2 text-right text-sm text-foreground focus:border-accent-orange focus:outline-none"
                      autoFocus
                    />
                  ) : (
                    <button
                      onClick={() => setEditingField('name')}
                      className="text-sm text-foreground-secondary hover:text-foreground"
                    >
                      {displayName || 'Set name'}
                    </button>
                  )}
                </div>
              </div>

              {/* Email (read-only) */}
              <div className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-background-elevated">
                    <User className="h-4 w-4 text-foreground-secondary" />
                  </div>
                  <div className="flex-1">
                    <span className="text-sm font-medium text-foreground">Email</span>
                  </div>
                  <span className="text-sm text-foreground-muted">{profile?.email ?? ''}</span>
                </div>
              </div>
            </div>
          </section>

          {/* Preferences Section */}
          <section>
            <h2 className="mb-2 text-xs font-medium uppercase tracking-wider text-foreground-muted">
              Preferences
            </h2>
            <div className="overflow-hidden rounded-lg border border-border-subtle bg-background-surface">
              {/* Rider Type */}
              <div className="border-b border-border-subtle px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-background-elevated">
                    <User className="h-4 w-4 text-foreground-secondary" />
                  </div>
                  <div className="flex-1">
                    <span className="text-sm font-medium text-foreground">Rider Type</span>
                    <p className="text-xs text-foreground-muted">Controls default navigation</p>
                  </div>
                  {editingField === 'riderType' ? (
                    <select
                      value={riderType}
                      onChange={(e) => {
                        setRiderTypeLocal(e.target.value as UserProfile['rider_type']);
                      }}
                      onBlur={() => handleProfileSave()}
                      className="h-8 rounded-md border border-border-subtle bg-background-elevated px-2 text-sm text-foreground focus:border-accent-orange focus:outline-none"
                      autoFocus
                      data-testid="rider-type-select"
                    >
                      <option value="street">Street</option>
                      <option value="casual_track">Casual Track</option>
                      <option value="competitive">Competitive</option>
                    </select>
                  ) : (
                    <button
                      onClick={() => setEditingField('riderType')}
                      className="text-sm text-foreground-secondary hover:text-foreground"
                    >
                      {riderTypeDisplay}
                    </button>
                  )}
                </div>
              </div>

              {/* Skill Level */}
              <div className="border-b border-border-subtle px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-background-elevated">
                    <User className="h-4 w-4 text-foreground-secondary" />
                  </div>
                  <div className="flex-1">
                    <span className="text-sm font-medium text-foreground">Skill Level</span>
                    <p className="text-xs text-foreground-muted">Affects suggestion verbosity</p>
                  </div>
                  {editingField === 'skillLevel' ? (
                    <select
                      value={skillLevel}
                      onChange={(e) => {
                        setSkillLevel(e.target.value as UserProfile['skill_level']);
                      }}
                      onBlur={() => handleProfileSave()}
                      className="h-8 rounded-md border border-border-subtle bg-background-elevated px-2 text-sm text-foreground focus:border-accent-orange focus:outline-none"
                      autoFocus
                    >
                      <option value="novice">Novice</option>
                      <option value="intermediate">Intermediate</option>
                      <option value="expert">Expert</option>
                    </select>
                  ) : (
                    <button
                      onClick={() => setEditingField('skillLevel')}
                      className="text-sm text-foreground-secondary hover:text-foreground"
                    >
                      {skillLevelDisplay}
                    </button>
                  )}
                </div>
              </div>

              {/* Units */}
              <div className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-background-elevated">
                    <Gauge className="h-4 w-4 text-foreground-secondary" />
                  </div>
                  <div className="flex-1">
                    <span className="text-sm font-medium text-foreground">Units</span>
                    <p className="text-xs text-foreground-muted">Measurement system</p>
                  </div>
                  {editingField === 'units' ? (
                    <select
                      value={units}
                      onChange={(e) => {
                        setUnits(e.target.value as UserProfile['units']);
                      }}
                      onBlur={() => handleProfileSave()}
                      className="h-8 rounded-md border border-border-subtle bg-background-elevated px-2 text-sm text-foreground focus:border-accent-orange focus:outline-none"
                      autoFocus
                    >
                      <option value="metric">Metric</option>
                      <option value="imperial">Imperial</option>
                    </select>
                  ) : (
                    <button
                      onClick={() => setEditingField('units')}
                      className="text-sm text-foreground-secondary hover:text-foreground"
                    >
                      {unitsDisplay}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Save button when editing */}
            {editingField && (
              <button
                onClick={handleProfileSave}
                disabled={updateProfile.isPending}
                className="mt-3 w-full rounded-lg bg-accent-orange px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-orange-hover disabled:opacity-50"
                data-testid="save-profile-btn"
              >
                {updateProfile.isPending ? 'Saving...' : 'Save Changes'}
              </button>
            )}
          </section>

          {/* Advanced Section */}
          <section>
            <h2 className="mb-2 text-xs font-medium uppercase tracking-wider text-foreground-muted">
              Advanced
            </h2>
            <div className="overflow-hidden rounded-lg border border-border-subtle bg-background-surface">
              <Link
                to="/settings/ecu"
                className="flex items-center gap-3 border-b border-border-subtle px-4 py-3 transition-colors hover:bg-background-elevated"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-background-elevated">
                  <Cpu className="h-4 w-4 text-foreground-secondary" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">ECU Settings</span>
                    <span className="rounded bg-accent-yellow/20 px-1.5 py-0.5 text-[10px] font-medium text-accent-yellow">
                      Expert
                    </span>
                  </div>
                  <p className="text-xs text-foreground-muted">HRC ECU mode configuration</p>
                </div>
                <ChevronRight className="h-4 w-4 text-foreground-muted" />
              </Link>

              <Link
                to="/settings/sag"
                className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-background-elevated"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-background-elevated">
                  <Ruler className="h-4 w-4 text-foreground-secondary" />
                </div>
                <div className="flex-1">
                  <span className="text-sm font-medium text-foreground">Sag Calculator</span>
                  <p className="text-xs text-foreground-muted">Measure and calculate suspension sag</p>
                </div>
                <ChevronRight className="h-4 w-4 text-foreground-muted" />
              </Link>
            </div>
          </section>

          {/* API Keys Section */}
          <section>
            <h2 className="mb-2 text-xs font-medium uppercase tracking-wider text-foreground-muted">
              API Keys
            </h2>
            <div className="overflow-hidden rounded-lg border border-border-subtle bg-background-surface">
              {keysLoading ? (
                <div className="p-4">
                  <LoadingSkeleton variant="lines" count={3} />
                </div>
              ) : (
                <div>
                  {/* Key list */}
                  <div data-testid="api-keys-list">
                    {apiKeys?.map((key, i) => (
                      <div
                        key={key.id}
                        className={cn(
                          'flex items-center justify-between px-4 py-3',
                          i !== (apiKeys?.length ?? 0) - 1 && 'border-b border-border-subtle'
                        )}
                      >
                        <div>
                          <p className="text-sm font-medium text-foreground">{key.name}</p>
                          <p className="text-xs text-foreground-muted">
                            {maskKey(key.id)}
                            {key.last_used_at && ` | Last used: ${new Date(key.last_used_at).toLocaleDateString()}`}
                            {key.expires_at && ` | Expires: ${new Date(key.expires_at).toLocaleDateString()}`}
                          </p>
                        </div>
                        <div>
                          {deleteConfirmId === key.id ? (
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleDeleteKey(key.id)}
                                className="min-h-[44px] flex items-center text-sm font-medium text-accent-red hover:underline"
                                data-testid={`confirm-delete-${key.id}`}
                              >
                                Confirm
                              </button>
                              <button
                                onClick={() => setDeleteConfirmId(null)}
                                className="min-h-[44px] flex items-center text-sm text-foreground-muted hover:underline"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setDeleteConfirmId(key.id)}
                              className="min-h-[44px] flex items-center text-sm text-accent-red hover:underline"
                              data-testid={`delete-key-${key.id}`}
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                    {apiKeys?.length === 0 && (
                      <p className="px-4 py-3 text-sm text-foreground-muted">No API keys yet.</p>
                    )}
                  </div>

                  {/* Created key banner */}
                  {createdKeyRaw && (
                    <div className="mx-4 mb-3 rounded-md border border-accent-green/30 bg-accent-green/10 p-3" data-testid="created-key-banner">
                      <p className="text-sm font-medium text-accent-green">
                        Key created! Copy it now, it will not be shown again:
                      </p>
                      <code className="text-sm text-foreground break-all">{createdKeyRaw}</code>
                    </div>
                  )}

                  {/* Create key form */}
                  <form onSubmit={handleCreateKey} className="border-t border-border-subtle p-4" data-testid="create-key-form">
                    <div className="flex flex-col gap-2">
                      <input
                        type="text"
                        placeholder="Key name"
                        value={newKeyName}
                        onChange={(e) => setNewKeyName(e.target.value)}
                        className="rounded-md border border-border-subtle bg-background-elevated px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted focus:border-accent-orange focus:outline-none"
                        data-testid="new-key-name"
                      />
                      <input
                        type="date"
                        placeholder="Expires (optional)"
                        value={newKeyExpires}
                        onChange={(e) => setNewKeyExpires(e.target.value)}
                        className="rounded-md border border-border-subtle bg-background-elevated px-3 py-2 text-sm text-foreground focus:border-accent-orange focus:outline-none"
                        data-testid="new-key-expires"
                      />
                      <button
                        type="submit"
                        disabled={createKey.isPending || !newKeyName.trim()}
                        className="rounded-md bg-accent-orange px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-orange-hover disabled:opacity-50"
                        data-testid="create-key-btn"
                      >
                        Create Key
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          </section>

          {/* Data Section */}
          <section>
            <h2 className="mb-2 text-xs font-medium uppercase tracking-wider text-foreground-muted">
              Data
            </h2>
            <div className="overflow-hidden rounded-lg border border-border-subtle bg-background-surface">
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-background-elevated">
                  <Download className="h-4 w-4 text-foreground-secondary" />
                </div>
                <div className="flex-1">
                  <span className="text-sm font-medium text-foreground">Export Data</span>
                  <p className="text-xs text-foreground-muted">Download all session data as CSV</p>
                </div>
              </div>
            </div>
          </section>

          {/* About Section */}
          <section>
            <h2 className="mb-2 text-xs font-medium uppercase tracking-wider text-foreground-muted">
              About
            </h2>
            <div className="overflow-hidden rounded-lg border border-border-subtle bg-background-surface">
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-background-elevated">
                  <Info className="h-4 w-4 text-foreground-secondary" />
                </div>
                <div className="flex-1">
                  <span className="text-sm font-medium text-foreground">App Version</span>
                </div>
                <span className="text-sm text-foreground-secondary">1.0.0 (build 42)</span>
              </div>
            </div>
          </section>

          {/* Sign Out */}
          <section>
            <button
              onClick={() => {
                logout();
                navigate('/login', { replace: true });
              }}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-accent-red/30 px-4 py-3 text-sm font-medium text-accent-red transition-colors hover:bg-accent-red/10"
              data-testid="settings-sign-out-btn"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>
          </section>
        </div>
      </main>
    </div>
  );
}
