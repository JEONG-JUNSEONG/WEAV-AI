import type { ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Pencil, Copy, FileSearch } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';
import type { Message, Citation, DocumentItem } from '@/types';

type ChatMessageProps = {
  message: Message;
  isLastUserMessage?: boolean;
  onEditRequested?: (prompt: string) => void;
  onShowCitations?: (citations: Citation[]) => void;
  documents?: DocumentItem[];
  onSelectDocument?: (docId: number) => void;
};

type DocMatch = { start: number; end: number; docId: number; text: string };

const escapeMarkdownLabel = (text: string) =>
  text.replace(/\\/g, '\\\\').replace(/\[/g, '\\[').replace(/\]/g, '\\]');

const findDocMatches = (content: string, documents: DocumentItem[]): DocMatch[] => {
  if (!content || documents.length === 0) return [];
  const matches: DocMatch[] = [];
  documents.forEach((doc) => {
    const name = doc.original_name;
    if (!name) return;
    const markers = [`@"${name}"`, `@'${name}'`, `@${name}`];
    markers.forEach((marker) => {
      let idx = content.indexOf(marker);
      while (idx !== -1) {
        matches.push({ start: idx, end: idx + marker.length, docId: doc.id, text: marker });
        idx = content.indexOf(marker, idx + marker.length);
      }
    });
  });
  if (matches.length === 0) return [];
  matches.sort((a, b) => (a.start - b.start) || (b.end - b.start) - (a.end - a.start));
  const filtered: DocMatch[] = [];
  let lastEnd = -1;
  matches.forEach((m) => {
    if (m.start < lastEnd) return;
    filtered.push(m);
    lastEnd = m.end;
  });
  return filtered;
};

const linkifyDocMentions = (content: string, documents: DocumentItem[]) => {
  const matches = findDocMatches(content, documents);
  if (matches.length === 0) return content;
  let cursor = 0;
  let output = '';
  matches.forEach((match) => {
    if (match.start > cursor) output += content.slice(cursor, match.start);
    const label = escapeMarkdownLabel(match.text);
    output += `[${label}](doc://${match.docId})`;
    cursor = match.end;
  });
  if (cursor < content.length) output += content.slice(cursor);
  return output;
};

const renderWithDocLinks = (
  content: string,
  documents: DocumentItem[],
  onSelectDocument?: (docId: number) => void
) => {
  const matches = findDocMatches(content, documents);
  if (matches.length === 0) return content;
  const nodes: ReactNode[] = [];
  let cursor = 0;
  matches.forEach((match, index) => {
    if (match.start > cursor) nodes.push(content.slice(cursor, match.start));
    nodes.push(
      <button
        key={`doc-mention-${match.docId}-${index}`}
        type="button"
        onClick={() => onSelectDocument?.(match.docId)}
        className="text-blue-400 underline underline-offset-2 hover:text-blue-300"
      >
        {match.text}
      </button>
    );
    cursor = match.end;
  });
  if (cursor < content.length) nodes.push(content.slice(cursor));
  return nodes;
};

export function ChatMessage({
  message,
  isLastUserMessage,
  onEditRequested,
  onShowCitations,
  documents = [],
  onSelectDocument,
}: ChatMessageProps) {
  const isUser = message.role === 'user';
  const { showToast } = useToast();
  const hasCitations = !isUser && Array.isArray(message.citations) && message.citations.length > 0;
  const renderedAssistantContent = linkifyDocMentions(message.content, documents);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    showToast('복사되었습니다');
  };

  return (
    <div
      className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4 group/msg ${
        isUser ? 'animate-slide-in-right' : 'animate-slide-in-left'
      }`}
    >
      <div className={`flex items-start gap-2 max-w-[85%] ${isUser ? 'flex-row' : ''}`}>
        <div
          className={`rounded-lg px-4 py-2 transition-colors duration-200 ${
            isUser ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground'
          }`}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">
              {renderWithDocLinks(message.content, documents, onSelectDocument)}
            </p>
          ) : (
          <div className="prose prose-invert prose-sm max-w-none">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                a({ href, children, ...props }) {
                  if (href && href.startsWith('doc://')) {
                    const docId = Number(href.replace('doc://', ''));
                    return (
                      <button
                        type="button"
                        onClick={() => onSelectDocument?.(docId)}
                        className="text-blue-400 underline underline-offset-2 hover:text-blue-300"
                      >
                        {children}
                      </button>
                    );
                  }
                  return (
                    <a href={href} {...props} className="text-blue-400 underline underline-offset-2 hover:text-blue-300">
                      {children}
                    </a>
                  );
                },
                code({ node, className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || '');
                  return match ? (
                    <SyntaxHighlighter
                      style={oneDark as any}
                      language={match[1]}
                      PreTag="div"
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
              {renderedAssistantContent}
            </ReactMarkdown>
            {hasCitations && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => onShowCitations?.(message.citations ?? [])}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80"
                >
                  <FileSearch size={14} />
                  답변 근거 확인
                </button>
              </div>
            )}
          </div>
          )}
        </div>
        {isUser && isLastUserMessage && onEditRequested && (
          <button
            type="button"
            onClick={() => onEditRequested(message.content)}
            className="p-1.5 rounded shrink-0 mt-1 bg-muted/80 text-muted-foreground hover:bg-muted hover:text-foreground border border-border transition-colors duration-200"
            title="하단 입력창에서 수정 후 재질문"
            aria-label="하단 입력창에서 수정 후 재질문"
          >
            <Pencil size={16} />
          </button>
        )}
        <button
          type="button"
          onClick={handleCopy}
          className="p-1.5 rounded shrink-0 mt-1 bg-muted/80 text-muted-foreground hover:bg-muted hover:text-foreground border border-border transition-colors duration-200 opacity-0 group-hover/msg:opacity-100 transition-opacity duration-200"
          title="복사"
          aria-label="복사"
        >
          <Copy size={16} />
        </button>
      </div>
    </div>
  );
}
