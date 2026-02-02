import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Pencil } from 'lucide-react';
import type { Message } from '@/types';

type ChatMessageProps = {
  message: Message;
  isLastUserMessage?: boolean;
  onEditRequested?: (prompt: string) => void;
};

export function ChatMessage({ message, isLastUserMessage, onEditRequested }: ChatMessageProps) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className={`flex items-start gap-2 max-w-[85%] ${isUser ? 'flex-row-reverse' : ''}`}>
        <div
          className={`rounded-lg px-4 py-2 ${
            isUser ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground'
          }`}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
          <div className="prose prose-invert prose-sm max-w-none">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code({ node, className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || '');
                  return match ? (
                    <SyntaxHighlighter
                      style={oneDark}
                      language={match[1]}
                      PreTag="div"
                      {...props}
                    >
                      {String(children).replace(/\n$/, '')}
                    </SyntaxHighlighter>
                  ) : (
                    <code className={className} {...props}>
                      {children}
                    </code>
                  );
                },
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>
          )}
        </div>
        {isUser && isLastUserMessage && onEditRequested && (
          <button
            type="button"
            onClick={() => onEditRequested(message.content)}
            className="p-1.5 rounded shrink-0 mt-1 bg-muted/80 text-muted-foreground hover:bg-muted hover:text-foreground border border-border"
            title="하단 입력창에서 수정 후 재질문"
            aria-label="하단 입력창에서 수정 후 재질문"
          >
            <Pencil size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
