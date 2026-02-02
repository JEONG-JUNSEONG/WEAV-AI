import React, { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useChat } from '@/contexts/ChatContext';
import { ModelSelector } from './ModelSelector';

const DEFAULT_CHAT_MODEL = 'google/gemini-2.5-flash';
const DEFAULT_IMAGE_MODEL = 'fal-ai/imagen4/preview';

type SessionModels = Record<number, { chat: string; image: string }>;

function getModelsForSession(modelBySession: SessionModels, sessionId: number) {
  const stored = modelBySession[sessionId];
  return {
    chat: stored?.chat ?? DEFAULT_CHAT_MODEL,
    image: stored?.image ?? DEFAULT_IMAGE_MODEL,
  };
}

export function ChatInput() {
  const { currentSession } = useApp();
  const { sendChatMessage, sendImageRequest, sending, error, clearError } = useChat();
  const [prompt, setPrompt] = useState('');
  const [modelBySession, setModelBySession] = useState<SessionModels>({});

  if (!currentSession) return null;

  const { chat: chatModel, image: imageModel } = getModelsForSession(modelBySession, currentSession.id);
  const isChat = currentSession.kind === 'chat';

  const setChatModel = (model: string) => {
    setModelBySession((prev) => ({
      ...prev,
      [currentSession.id]: {
        ...getModelsForSession(prev, currentSession.id),
        chat: model,
      },
    }));
  };
  const setImageModel = (model: string) => {
    setModelBySession((prev) => ({
      ...prev,
      [currentSession.id]: {
        ...getModelsForSession(prev, currentSession.id),
        image: model,
      },
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = prompt.trim();
    if (!text || sending) return;
    setPrompt('');
    if (isChat) await sendChatMessage(text, chatModel);
    else await sendImageRequest(text, imageModel);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/95 border-t border-border">
      {error && (
        <div className="max-w-3xl mx-auto mb-2 flex items-center justify-between rounded bg-destructive/50 text-destructive-foreground px-3 py-2 text-sm">
          <span>{error}</span>
          <button type="button" onClick={clearError} className="hover:text-primary">
            닫기
          </button>
        </div>
      )}
      <form onSubmit={handleSubmit} className="max-w-3xl mx-auto flex flex-col gap-2">
        <div className="flex gap-2 items-center">
          <ModelSelector
            kind={currentSession.kind}
            value={isChat ? chatModel : imageModel}
            onChange={isChat ? setChatModel : setImageModel}
          />
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={isChat ? '메시지를 입력하세요...' : '이미지 설명을 입력하세요...'}
            className="flex-1 bg-input border border-input rounded px-4 py-2 text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            disabled={sending}
          />
          <button
            type="submit"
            disabled={sending || !prompt.trim()}
            className="px-4 py-2 rounded bg-primary text-primary-foreground font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90"
          >
            {sending ? '처리 중...' : isChat ? '전송' : '생성'}
          </button>
        </div>
      </form>
    </div>
  );
}
