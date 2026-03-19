import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPatch, apiDelete } from '@/api/client';
import type {
  ChannelAlias,
  CreateChannelAliasRequest,
  UpdateChannelAliasRequest,
} from '@/api/types';

export function useChannelAliases() {
  return useQuery({
    queryKey: ['channel-aliases'],
    queryFn: () => apiGet<ChannelAlias[]>('/admin/channel-aliases'),
  });
}

export function useCreateChannelAlias() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateChannelAliasRequest) =>
      apiPost<ChannelAlias>('/admin/channel-aliases', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channel-aliases'] });
    },
  });
}

export function useUpdateChannelAlias() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ aliasId, data }: { aliasId: string; data: UpdateChannelAliasRequest }) =>
      apiPatch<ChannelAlias>(`/admin/channel-aliases/${aliasId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channel-aliases'] });
    },
  });
}

export function useDeleteChannelAlias() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (aliasId: string) =>
      apiDelete(`/admin/channel-aliases/${aliasId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channel-aliases'] });
    },
  });
}
