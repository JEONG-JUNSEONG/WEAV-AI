import { useEffect, useRef } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useChat } from '@/contexts/ChatContext';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';

export function ChatView() {
  const { currentSession } = useApp();
  const { setRegeneratePrompt } = useChat();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentSession?.messages, currentSession?.image_records]);

  if (!currentSession) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <p>왼쪽 메뉴에서 새 채팅 또는 새 이미지를 시작하세요.</p>
      </div>
    );
  }

  const isChat = currentSession.kind === 'chat';
  const messages = currentSession.messages ?? [];
  const imageRecords = currentSession.image_records ?? [];

  return (
    <div className="flex-1 flex flex-col w-full max-w-3xl mx-auto">
      <main className="flex-1 overflow-y-auto px-4 pt-6 pb-40">
        {isChat ? (
          messages.length === 0 ? (
            <div className="text-center text-muted-foreground py-12">
              <p>메시지를 입력하고 전송하세요.</p>
            </div>
          ) : (
            messages.map((msg) => {
              const lastUserMsg =
                messages.length >= 2 && messages[messages.length - 1].role === 'assistant'
                  ? messages[messages.length - 2]
                  : null;
              const isLastUserMessage =
                msg.role === 'user' && lastUserMsg != null && msg.id === lastUserMsg.id;
              return (
                <ChatMessage
                  key={msg.id}
                  message={msg}
                  isLastUserMessage={isLastUserMessage}
                  onEditRequested={
                    isLastUserMessage && currentSession
                      ? (prompt) => setRegeneratePrompt(currentSession.id, prompt)
                      : undefined
                  }
                />
              );
            })
          )
        ) : (
          <>
            {imageRecords.length === 0 && (
              <div className="text-center text-muted-foreground py-12">
                <p>이미지 설명을 입력하고 생성하세요.</p>
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              {imageRecords.map((rec) => (
                <div key={rec.id} className="rounded-lg overflow-hidden bg-card">
                  <img
                    src={rec.image_url}
                    alt={rec.prompt}
                    className="w-full h-auto object-cover"
                  />
                  <p className="p-2 text-sm text-muted-foreground truncate" title={rec.prompt}>
                    {rec.prompt}
                  </p>
                </div>
              ))}
            </div>
          </>
        )}
        <div ref={endRef} />
      </main>
      <ChatInput />
    </div>
  );
}
