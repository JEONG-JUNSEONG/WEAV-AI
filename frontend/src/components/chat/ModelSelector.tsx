import { CHAT_MODELS } from '@/constants/models';
import { IMAGE_MODELS } from '@/constants/models';
import { ChevronDown } from 'lucide-react';
import type { SessionKind } from '@/types';

type ModelSelectorProps = {
  kind: SessionKind;
  value: string;
  onChange: (modelId: string) => void;
};

export function ModelSelector({ kind, value, onChange }: ModelSelectorProps) {
  const models = kind === 'chat' ? CHAT_MODELS : IMAGE_MODELS;
  return (
    <div className="relative inline-flex min-w-[180px] h-9 items-center pl-1 pr-7 text-muted-foreground hover:text-foreground transition-colors duration-200">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-full w-full appearance-none bg-transparent text-sm text-foreground focus:outline-none"
        style={{ WebkitAppearance: 'none', MozAppearance: 'none' }}
      >
        {models.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>
      <ChevronDown
        size={14}
        className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground"
      />
    </div>
  );
}
