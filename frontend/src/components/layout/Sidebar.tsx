import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, Image, ChevronDown, ChevronRight, Trash2, Pencil } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import type { Session } from '@/types';

type SidebarProps = {
  open: boolean;
  onClose: () => void;
};

export function Sidebar({ open, onClose }: SidebarProps) {
  const { sessions, currentSession, selectSession, createSession, patchSession, deleteSession } = useApp();
  const [chatExpanded, setChatExpanded] = useState(true);
  const [imageExpanded, setImageExpanded] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const chatSessions = sessions.filter((s) => s.kind === 'chat');
  const imageSessions = sessions.filter((s) => s.kind === 'image');

  useEffect(() => {
    if (editingId !== null) {
      setEditingTitle(sessions.find((s) => s.id === editingId)?.title ?? '');
      inputRef.current?.focus();
    }
  }, [editingId, sessions]);

  const handleNewChat = async () => {
    await createSession('chat', '새 채팅');
  };
  const handleNewImage = async () => {
    await createSession('image', '새 이미지');
  };
  const handleSelect = async (s: Session) => {
    await selectSession(s);
  };

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (!window.confirm('이 채팅을 삭제할까요?')) return;
    await deleteSession(id);
  };

  const handleDeleteImage = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (!window.confirm('이 이미지 세션을 삭제할까요?')) return;
    await deleteSession(id);
  };

  const startEdit = (e: React.MouseEvent, s: Session) => {
    e.stopPropagation();
    setEditingId(s.id);
  };

  const saveTitle = async () => {
    if (editingId === null) return;
    const trimmed = editingTitle.trim();
    if (trimmed) await patchSession(editingId, { title: trimmed });
    setEditingId(null);
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveTitle();
    }
    if (e.key === 'Escape') {
      setEditingId(null);
    }
  };

  return (
    <aside
      className={`fixed left-0 top-0 bottom-0 w-72 bg-card text-foreground z-40 flex flex-col shadow-xl transition-transform duration-300 ease-out ${
        open ? 'translate-x-0' : '-translate-x-full'
      } ${!open ? 'pointer-events-none' : ''}`}
      aria-hidden={!open}
    >
        <div className="p-4 border-b border-border flex items-center justify-between">
          <span className="font-semibold">WEAV AI</span>
          <button type="button" onClick={onClose} className="p-1 hover:bg-accent rounded">
            ✕
          </button>
        </div>
        <div className="p-2 flex gap-2">
          <button
            type="button"
            onClick={handleNewChat}
            className="flex-1 flex items-center justify-center gap-2 py-2 rounded bg-muted hover:bg-muted-foreground text-sm"
          >
            <MessageSquare size={16} /> 새 채팅
          </button>
          <button
            type="button"
            onClick={handleNewImage}
            className="flex-1 flex items-center justify-center gap-2 py-2 rounded bg-muted hover:bg-muted-foreground text-sm"
          >
            <Image size={16} /> 새 이미지
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          <div className="mb-4">
            <button
              type="button"
              onClick={() => setChatExpanded((v) => !v)}
              className="w-full flex items-center gap-1 text-xs font-medium text-muted-foreground uppercase tracking-wider px-2 py-1.5 mb-1 rounded hover:bg-accent/50"
            >
              {chatExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              채팅 {chatSessions.length > 0 && `(${chatSessions.length})`}
            </button>
            {chatExpanded && (
              <>
                {chatSessions.length === 0 && (
                  <p className="text-muted-foreground text-sm px-2">채팅 내역이 없습니다.</p>
                )}
                {chatSessions.map((s) => (
                  <div
                    key={s.id}
                    className={`group flex items-center gap-1 rounded text-sm ${
                      currentSession?.id === s.id ? 'bg-accent' : 'hover:bg-accent'
                    }`}
                  >
                    {editingId === s.id ? (
                      <input
                        ref={editingId === s.id ? inputRef : undefined}
                        type="text"
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        onBlur={saveTitle}
                        onKeyDown={handleTitleKeyDown}
                        onClick={(e) => e.stopPropagation()}
                        className="flex-1 min-w-0 px-2 py-1.5 text-sm bg-background border border-border rounded"
                        placeholder="제목"
                      />
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => handleSelect(s)}
                          className="flex-1 min-w-0 text-left px-3 py-2 truncate"
                        >
                          {s.title || `채팅 ${s.id}`}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => startEdit(e, s)}
                          className="p-1.5 rounded opacity-60 hover:opacity-100 hover:bg-accent text-muted-foreground shrink-0"
                          title="제목 변경"
                          aria-label="제목 변경"
                        >
                          <Pencil size={14} />
                        </button>
                      </>
                    )}
                    {editingId !== s.id && (
                      <button
                        type="button"
                        onClick={(e) => handleDelete(e, s.id)}
                        className="p-1.5 rounded opacity-60 hover:opacity-100 hover:bg-destructive/20 text-muted-foreground hover:text-destructive shrink-0"
                        title="채팅 삭제"
                        aria-label="채팅 삭제"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </>
            )}
          </div>
          <div>
            <button
              type="button"
              onClick={() => setImageExpanded((v) => !v)}
              className="w-full flex items-center gap-1 text-xs font-medium text-muted-foreground uppercase tracking-wider px-2 py-1.5 mb-1 rounded hover:bg-accent/50"
            >
              {imageExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              이미지 {imageSessions.length > 0 && `(${imageSessions.length})`}
            </button>
            {imageExpanded && (
              <>
                {imageSessions.length === 0 && (
                  <p className="text-muted-foreground text-sm px-2">이미지 생성 내역이 없습니다.</p>
                )}
                {imageSessions.map((s) => (
                  <div
                    key={s.id}
                    className={`group flex items-center gap-1 rounded text-sm ${
                      currentSession?.id === s.id ? 'bg-accent' : 'hover:bg-accent'
                    }`}
                  >
                    {editingId === s.id ? (
                      <input
                        ref={editingId === s.id ? inputRef : undefined}
                        type="text"
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        onBlur={saveTitle}
                        onKeyDown={handleTitleKeyDown}
                        onClick={(e) => e.stopPropagation()}
                        className="flex-1 min-w-0 px-2 py-1.5 text-sm bg-background border border-border rounded"
                        placeholder="제목"
                      />
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => handleSelect(s)}
                          className="flex-1 min-w-0 text-left px-3 py-2 truncate"
                        >
                          {s.title || `이미지 ${s.id}`}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => startEdit(e, s)}
                          className="p-1.5 rounded opacity-60 hover:opacity-100 hover:bg-accent text-muted-foreground shrink-0"
                          title="제목 변경"
                          aria-label="제목 변경"
                        >
                          <Pencil size={14} />
                        </button>
                      </>
                    )}
                    {editingId !== s.id && (
                      <button
                        type="button"
                        onClick={(e) => handleDeleteImage(e, s.id)}
                        className="p-1.5 rounded opacity-60 hover:opacity-100 hover:bg-destructive/20 text-muted-foreground hover:text-destructive shrink-0"
                        title="세션 삭제"
                        aria-label="세션 삭제"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      </aside>
  );
}
