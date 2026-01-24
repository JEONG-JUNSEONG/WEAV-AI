/**
 * 채팅/폴더 API — DB 저장 (로그아웃 후 유지)
 */
import { apiClient } from './apiClient';
import type { ChatSession, Folder } from '../types';

const mapFolder = (r: any): Folder => ({
  id: String(r.id),
  name: r.name,
  type: r.type || 'custom',
  createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
});

const mapChat = (r: any): ChatSession => ({
  id: String(r.id),
  title: r.title,
  messages: Array.isArray(r.messages) ? r.messages : [],
  modelId: r.model_id || 'gpt-5.2-instant',
  systemInstruction: r.system_instruction,
  folderId: r.folder_id != null ? String(r.folder_id) : undefined,
  lastModified: r.last_modified ? new Date(r.last_modified).getTime() : Date.now(),
  recommendedPrompts: Array.isArray(r.recommended_prompts) ? r.recommended_prompts : [],
});

export const chatApi = {
  async getFolders(): Promise<Folder[]> {
    const list = (await apiClient.get<unknown[]>('/api/v1/chats/folders/')) as any[];
    return list.map(mapFolder);
  },

  async createFolder(name: string, type: 'custom' | 'shorts-workflow' = 'custom'): Promise<Folder> {
    const r = (await apiClient.post<unknown>('/api/v1/chats/folders/', { name, type })) as any;
    return mapFolder(r);
  },

  async deleteFolder(id: string): Promise<void> {
    await apiClient.delete(`/api/v1/chats/folders/${id}/`);
  },

  async getChats(folderId?: string | null): Promise<ChatSession[]> {
    const url = folderId
      ? `/api/v1/chats/chats/?folder=${folderId}`
      : '/api/v1/chats/chats/';
    const list = (await apiClient.get<unknown[]>(url)) as any[];
    return list.map(mapChat);
  },

  async createChat(payload: {
    title: string;
    folder_id?: string | null;
    messages?: unknown[];
    model_id?: string;
    system_instruction?: string;
    recommended_prompts?: string[];
  }): Promise<ChatSession> {
    const body: Record<string, unknown> = {
      title: payload.title,
      messages: payload.messages ?? [],
      model_id: payload.model_id ?? 'gpt-5.2-instant',
      system_instruction: payload.system_instruction ?? '',
      recommended_prompts: payload.recommended_prompts ?? [],
    };
    if (payload.folder_id != null) body.folder_id = payload.folder_id;
    const r = (await apiClient.post<unknown>('/api/v1/chats/chats/', body)) as any;
    return mapChat(r);
  },

  async updateChat(
    id: string,
    updates: Partial<{
      title: string;
      messages: unknown[];
      model_id: string;
      system_instruction: string;
      recommended_prompts: string[];
    }>
  ): Promise<ChatSession> {
    const body: Record<string, unknown> = {};
    if (updates.title != null) body.title = updates.title;
    if (updates.messages != null) body.messages = updates.messages;
    if (updates.model_id != null) body.model_id = updates.model_id;
    if (updates.system_instruction != null) body.system_instruction = updates.system_instruction;
    if (updates.recommended_prompts != null) body.recommended_prompts = updates.recommended_prompts;
    const r = (await apiClient.put<unknown>(`/api/v1/chats/chats/${id}/`, body)) as any;
    return mapChat(r);
  },

  async deleteChat(id: string): Promise<void> {
    await apiClient.delete(`/api/v1/chats/chats/${id}/`);
  },
};
