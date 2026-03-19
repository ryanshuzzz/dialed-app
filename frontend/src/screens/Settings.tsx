import { useState } from 'react';
import {
  useProfile,
  useUpdateProfile,
  useApiKeys,
  useCreateApiKey,
  useDeleteApiKey,
} from '@/hooks/useAuth';
import { useUiStore } from '@/stores/uiStore';
import type { UserProfile } from '@/api/types';

export default function Settings() {
  const { data: profile, isLoading: profileLoading } = useProfile();
  const updateProfile = useUpdateProfile();
  const { data: apiKeys, isLoading: keysLoading } = useApiKeys();
  const createKey = useCreateApiKey();
  const deleteKey = useDeleteApiKey();
  const setRiderType = useUiStore((s) => s.setRiderType);

  // Local form state
  const [displayName, setDisplayName] = useState<string>('');
  const [riderType, setRiderTypeLocal] = useState<UserProfile['rider_type']>('street');
  const [skillLevel, setSkillLevel] = useState<UserProfile['skill_level']>('novice');
  const [units, setUnits] = useState<UserProfile['units']>('metric');
  const [profileInitialized, setProfileInitialized] = useState(false);

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

  if (profileLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <h2 className="text-2xl font-bold">Settings</h2>

      {/* Profile Section */}
      <section className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold mb-4">Profile</h3>
        <div className="space-y-4">
          <div>
            <label htmlFor="display-name" className="block text-sm font-medium text-gray-700 mb-1">
              Display Name
            </label>
            <input
              id="display-name"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              placeholder="Your name"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={profile?.email ?? ''}
              readOnly
              className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm bg-gray-50 text-gray-500"
            />
          </div>

          <div>
            <label htmlFor="rider-type" className="block text-sm font-medium text-gray-700 mb-1">
              Rider Type
            </label>
            <select
              id="rider-type"
              value={riderType}
              onChange={(e) => setRiderTypeLocal(e.target.value as UserProfile['rider_type'])}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              data-testid="rider-type-select"
            >
              <option value="street">Street</option>
              <option value="casual_track">Casual Track</option>
              <option value="competitive">Competitive</option>
            </select>
          </div>

          <div>
            <label htmlFor="skill-level" className="block text-sm font-medium text-gray-700 mb-1">
              Skill Level
            </label>
            <select
              id="skill-level"
              value={skillLevel}
              onChange={(e) => setSkillLevel(e.target.value as UserProfile['skill_level'])}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="novice">Novice</option>
              <option value="intermediate">Intermediate</option>
              <option value="expert">Expert</option>
            </select>
          </div>

          <div>
            <label htmlFor="units" className="block text-sm font-medium text-gray-700 mb-1">
              Units
            </label>
            <select
              id="units"
              value={units}
              onChange={(e) => setUnits(e.target.value as UserProfile['units'])}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="metric">Metric</option>
              <option value="imperial">Imperial</option>
            </select>
          </div>

          <button
            onClick={handleProfileSave}
            disabled={updateProfile.isPending}
            className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            data-testid="save-profile-btn"
          >
            {updateProfile.isPending ? 'Saving...' : 'Save Profile'}
          </button>
        </div>
      </section>

      {/* API Keys Section */}
      <section className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold mb-4">API Keys</h3>

        {keysLoading ? (
          <p className="text-gray-500 text-sm">Loading keys...</p>
        ) : (
          <div className="space-y-4">
            {/* Key list */}
            <div className="space-y-2" data-testid="api-keys-list">
              {apiKeys?.map((key) => (
                <div
                  key={key.id}
                  className="flex items-center justify-between border border-gray-100 rounded-md p-3"
                >
                  <div>
                    <p className="font-medium text-sm">{key.name}</p>
                    <p className="text-xs text-gray-500">
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
                          className="text-red-600 text-sm font-medium hover:underline"
                          data-testid={`confirm-delete-${key.id}`}
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(null)}
                          className="text-gray-500 text-sm hover:underline"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirmId(key.id)}
                        className="text-red-500 text-sm hover:underline"
                        data-testid={`delete-key-${key.id}`}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {apiKeys?.length === 0 && (
                <p className="text-sm text-gray-500">No API keys yet.</p>
              )}
            </div>

            {/* Created key banner */}
            {createdKeyRaw && (
              <div className="bg-green-50 border border-green-200 rounded-md p-3" data-testid="created-key-banner">
                <p className="text-sm font-medium text-green-800">
                  Key created! Copy it now, it will not be shown again:
                </p>
                <code className="text-sm text-green-900 break-all">{createdKeyRaw}</code>
              </div>
            )}

            {/* Create key form */}
            <form onSubmit={handleCreateKey} className="flex flex-col sm:flex-row gap-2" data-testid="create-key-form">
              <input
                type="text"
                placeholder="Key name"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm flex-1"
                data-testid="new-key-name"
              />
              <input
                type="date"
                placeholder="Expires (optional)"
                value={newKeyExpires}
                onChange={(e) => setNewKeyExpires(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm"
                data-testid="new-key-expires"
              />
              <button
                type="submit"
                disabled={createKey.isPending || !newKeyName.trim()}
                className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                data-testid="create-key-btn"
              >
                Create Key
              </button>
            </form>
          </div>
        )}
      </section>
    </div>
  );
}
