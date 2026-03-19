import { useState } from 'react';
import {
  useChannelAliases,
  useCreateChannelAlias,
  useUpdateChannelAlias,
  useDeleteChannelAlias,
} from '@/hooks/useAdmin';

interface EditState {
  raw_name: string;
  canonical_name: string;
  logger_model: string;
}

export default function Admin() {
  const { data: aliases, isLoading } = useChannelAliases();
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
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Loading channel aliases...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Admin - Channel Aliases</h2>

      {/* Add Form */}
      <form
        onSubmit={handleAdd}
        className="bg-white rounded-lg border border-gray-200 p-4 flex flex-col sm:flex-row gap-2"
        data-testid="add-alias-form"
      >
        <input
          type="text"
          placeholder="Raw name"
          value={newRawName}
          onChange={(e) => setNewRawName(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm flex-1"
          data-testid="new-raw-name"
        />
        <input
          type="text"
          placeholder="Canonical name"
          value={newCanonicalName}
          onChange={(e) => setNewCanonicalName(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm flex-1"
          data-testid="new-canonical-name"
        />
        <input
          type="text"
          placeholder="Logger model (optional)"
          value={newLoggerModel}
          onChange={(e) => setNewLoggerModel(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm flex-1"
          data-testid="new-logger-model"
        />
        <button
          type="submit"
          disabled={createAlias.isPending || !newRawName.trim() || !newCanonicalName.trim()}
          className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          data-testid="add-alias-btn"
        >
          Add
        </button>
      </form>

      {/* Alias Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm" data-testid="alias-table">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-4 py-3 text-left font-medium text-gray-600">Raw Name</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Canonical Name</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Logger Model</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody>
            {aliases?.map((alias) => (
              <tr key={alias.id} className="border-b border-gray-100 hover:bg-gray-50">
                {editingId === alias.id ? (
                  <>
                    <td className="px-4 py-2">
                      <input
                        type="text"
                        value={editState.raw_name}
                        onChange={(e) => setEditState((s) => ({ ...s, raw_name: e.target.value }))}
                        className="border border-gray-300 rounded px-2 py-1 text-sm w-full"
                        data-testid="edit-raw-name"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="text"
                        value={editState.canonical_name}
                        onChange={(e) => setEditState((s) => ({ ...s, canonical_name: e.target.value }))}
                        className="border border-gray-300 rounded px-2 py-1 text-sm w-full"
                        data-testid="edit-canonical-name"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="text"
                        value={editState.logger_model}
                        onChange={(e) => setEditState((s) => ({ ...s, logger_model: e.target.value }))}
                        className="border border-gray-300 rounded px-2 py-1 text-sm w-full"
                        data-testid="edit-logger-model"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex gap-2">
                        <button
                          onClick={handleSaveEdit}
                          className="text-blue-600 text-sm font-medium hover:underline"
                          data-testid="save-edit-btn"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="text-gray-500 text-sm hover:underline"
                          data-testid="cancel-edit-btn"
                        >
                          Cancel
                        </button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-4 py-3">{alias.raw_name}</td>
                    <td className="px-4 py-3">{alias.canonical_name}</td>
                    <td className="px-4 py-3 text-gray-500">{alias.logger_model ?? '-'}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => startEdit(alias)}
                          className="text-blue-600 text-sm hover:underline"
                          data-testid={`edit-${alias.id}`}
                        >
                          Edit
                        </button>
                        {deleteConfirmId === alias.id ? (
                          <>
                            <button
                              onClick={() => handleDelete(alias.id)}
                              className="text-red-600 text-sm font-medium hover:underline"
                              data-testid={`confirm-delete-${alias.id}`}
                            >
                              Confirm
                            </button>
                            <button
                              onClick={() => setDeleteConfirmId(null)}
                              className="text-gray-500 text-sm hover:underline"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirmId(alias.id)}
                            className="text-red-500 text-sm hover:underline"
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
            {aliases?.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-gray-500">
                  No channel aliases configured.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
