import { useState } from 'react';
import {
  useChannelAliases,
  useCreateChannelAlias,
  useUpdateChannelAlias,
  useDeleteChannelAlias,
} from '@/hooks/useAdmin';
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton';
import { ErrorState } from '@/components/common/ErrorState';
import { EmptyState } from '@/components/common/EmptyState';

interface EditState {
  raw_name: string;
  canonical_name: string;
  logger_model: string;
}

export default function Admin() {
  const { data: aliases, isLoading, isError, refetch } = useChannelAliases();
  const createAlias = useCreateChannelAlias();
  const updateAlias = useUpdateChannelAlias();
  const deleteAlias = useDeleteChannelAlias();

  // Add form state
  const [newRawName, setNewRawName] = useState('');
  const [newCanonicalName, setNewCanonicalName] = useState('');
  const [newLoggerModel, setNewLoggerModel] = useState('');

  // Inline edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState>({ raw_name: '', canonical_name: '', logger_model: '' });

  // Delete confirmation
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newRawName.trim() || !newCanonicalName.trim()) return;
    createAlias.mutate(
      {
        raw_name: newRawName.trim(),
        canonical_name: newCanonicalName.trim(),
        logger_model: newLoggerModel.trim() || null,
      },
      {
        onSuccess: () => {
          setNewRawName('');
          setNewCanonicalName('');
          setNewLoggerModel('');
        },
      },
    );
  }

  function startEdit(alias: { id: string; raw_name: string; canonical_name: string; logger_model?: string | null }) {
    setEditingId(alias.id);
    setEditState({
      raw_name: alias.raw_name,
      canonical_name: alias.canonical_name,
      logger_model: alias.logger_model ?? '',
    });
  }

  function handleSaveEdit() {
    if (!editingId) return;
    updateAlias.mutate(
      {
        aliasId: editingId,
        data: {
          raw_name: editState.raw_name,
          canonical_name: editState.canonical_name,
          logger_model: editState.logger_model || null,
        },
      },
      {
        onSuccess: () => {
          setEditingId(null);
        },
      },
    );
  }

  function handleDelete(id: string) {
    deleteAlias.mutate(id, {
      onSuccess: () => {
        setDeleteConfirmId(null);
      },
    });
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Admin - Channel Aliases</h2>
        <LoadingSkeleton variant="table" count={4} />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Admin - Channel Aliases</h2>
        <ErrorState message="Failed to load channel aliases." onRetry={() => refetch()} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Admin - Channel Aliases</h2>

      {/* Add Form */}
      <form
        onSubmit={handleAdd}
        className="bg-background-surface rounded-lg border border-border-subtle p-4 flex flex-col sm:flex-row gap-2"
        data-testid="add-alias-form"
      >
        <input
          type="text"
          placeholder="Raw name"
          value={newRawName}
          onChange={(e) => setNewRawName(e.target.value)}
          className="border border-border rounded-md px-3 py-2 min-h-[44px] text-sm flex-1"
          data-testid="new-raw-name"
        />
        <input
          type="text"
          placeholder="Canonical name"
          value={newCanonicalName}
          onChange={(e) => setNewCanonicalName(e.target.value)}
          className="border border-border rounded-md px-3 py-2 min-h-[44px] text-sm flex-1"
          data-testid="new-canonical-name"
        />
        <input
          type="text"
          placeholder="Logger model (optional)"
          value={newLoggerModel}
          onChange={(e) => setNewLoggerModel(e.target.value)}
          className="border border-border rounded-md px-3 py-2 min-h-[44px] text-sm flex-1"
          data-testid="new-logger-model"
        />
        <button
          type="submit"
          disabled={createAlias.isPending || !newRawName.trim() || !newCanonicalName.trim()}
          className="bg-accent-orange text-white px-4 py-2 min-h-[44px] rounded-md text-sm font-medium hover:bg-accent-orange-hover disabled:opacity-50"
          data-testid="add-alias-btn"
        >
          Add
        </button>
      </form>

      {/* Alias Table */}
      {aliases && aliases.length > 0 ? (
        <div className="bg-background-surface rounded-lg border border-border-subtle overflow-x-auto">
          <table className="w-full text-sm" data-testid="alias-table">
            <thead>
              <tr className="border-b border-border-subtle bg-background-elevated">
                <th className="px-3 sm:px-4 py-3 text-left font-medium text-foreground-secondary">Raw Name</th>
                <th className="px-3 sm:px-4 py-3 text-left font-medium text-foreground-secondary">Canonical Name</th>
                <th className="px-3 sm:px-4 py-3 text-left font-medium text-foreground-secondary hidden sm:table-cell">Logger Model</th>
                <th className="px-3 sm:px-4 py-3 text-left font-medium text-foreground-secondary">Actions</th>
              </tr>
            </thead>
            <tbody>
              {aliases.map((alias) => (
                <tr key={alias.id} className="border-b border-border-subtle hover:bg-background-elevated">
                  {editingId === alias.id ? (
                    <>
                      <td className="px-3 sm:px-4 py-2">
                        <input
                          type="text"
                          value={editState.raw_name}
                          onChange={(e) => setEditState((s) => ({ ...s, raw_name: e.target.value }))}
                          className="border border-border rounded px-2 py-1 min-h-[44px] text-sm w-full"
                          data-testid="edit-raw-name"
                        />
                      </td>
                      <td className="px-3 sm:px-4 py-2">
                        <input
                          type="text"
                          value={editState.canonical_name}
                          onChange={(e) => setEditState((s) => ({ ...s, canonical_name: e.target.value }))}
                          className="border border-border rounded px-2 py-1 min-h-[44px] text-sm w-full"
                          data-testid="edit-canonical-name"
                        />
                      </td>
                      <td className="px-3 sm:px-4 py-2 hidden sm:table-cell">
                        <input
                          type="text"
                          value={editState.logger_model}
                          onChange={(e) => setEditState((s) => ({ ...s, logger_model: e.target.value }))}
                          className="border border-border rounded px-2 py-1 min-h-[44px] text-sm w-full"
                          data-testid="edit-logger-model"
                        />
                      </td>
                      <td className="px-3 sm:px-4 py-2">
                        <div className="flex gap-2">
                          <button
                            onClick={handleSaveEdit}
                            className="text-accent-orange text-sm font-medium hover:underline min-h-[44px] flex items-center"
                            data-testid="save-edit-btn"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="text-foreground-muted text-sm hover:underline min-h-[44px] flex items-center"
                            data-testid="cancel-edit-btn"
                          >
                            Cancel
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-3 sm:px-4 py-3">{alias.raw_name}</td>
                      <td className="px-3 sm:px-4 py-3">{alias.canonical_name}</td>
                      <td className="px-3 sm:px-4 py-3 text-foreground-muted hidden sm:table-cell">{alias.logger_model ?? '-'}</td>
                      <td className="px-3 sm:px-4 py-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => startEdit(alias)}
                            className="text-accent-orange text-sm hover:underline min-h-[44px] flex items-center"
                            data-testid={`edit-${alias.id}`}
                          >
                            Edit
                          </button>
                          {deleteConfirmId === alias.id ? (
                            <>
                              <button
                                onClick={() => handleDelete(alias.id)}
                                className="text-red-600 text-sm font-medium hover:underline min-h-[44px] flex items-center"
                                data-testid={`confirm-delete-${alias.id}`}
                              >
                                Confirm
                              </button>
                              <button
                                onClick={() => setDeleteConfirmId(null)}
                                className="text-foreground-muted text-sm hover:underline min-h-[44px] flex items-center"
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => setDeleteConfirmId(alias.id)}
                              className="text-red-500 text-sm hover:underline min-h-[44px] flex items-center"
                              data-testid={`delete-${alias.id}`}
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          title="No channel aliases"
          description="Add your first channel alias to map AiM column names to canonical names."
        />
      )}
    </div>
  );
}
