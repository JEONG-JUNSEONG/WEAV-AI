import React, { useState, useRef, useEffect, memo, useCallback, useMemo } from 'react';
import { ChevronDown, Box, Lock } from 'lucide-react';
import { AIModel, ModelCategory } from '../../types';
import { MODELS } from '../../constants/models';
import { useAuth } from '../../contexts/AuthContext';

interface ModelSelectorProps {
  selectedModel: AIModel;
  onSelect: (model: AIModel) => void;
  disabled?: boolean;
}

// Custom Icons
const OpenAILogo = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg">
    <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a1.54 1.54 0 0 1 .8312 1.2823v5.6365a4.4614 4.4614 0 0 1-5.2877 3.2102zm6.9635-3.1a4.4661 4.4661 0 0 1-2.2248 2.5762l-.1418.085-4.7831 2.7582a.7948.7948 0 0 0-.3927.6813v6.7466l-2.02-1.1686a1.54 1.54 0 0 1-.8312-1.2871v-5.6318a4.4566 4.4566 0 0 1 5.3886-3.1436 4.49 4.49 0 0 1 5.0049 1.3837zM4.292 8.5278a4.4755 4.4755 0 0 1 2.6122-2.1288 4.4996 4.4996 0 0 1 2.433.0566l-.1418.0803-4.7783 2.7582a.7948.7948 0 0 0-.3927.6813v6.7369l-2.02-1.1686a1.54 1.54 0 0 1-.8312-1.2823V8.6293a4.4661 4.4661 0 0 1 1.1188-2.6775zM12 10.9749L9.4294 12.459 6.8587 10.975V8.0068l2.5707-1.4842 2.5707 1.4842v2.9681z" />
  </svg>
);

const GeminiLogo = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg">
    <path d="M11.05 2.14C11.3 1.09 12.7 1.09 12.95 2.14C13.56 4.7 15.58 6.72 18.14 7.33C19.19 7.58 19.19 8.98 18.14 9.23C15.58 9.84 13.56 11.86 12.95 14.42C12.7 15.47 11.3 15.47 11.05 14.42C10.44 11.86 8.42 9.84 5.86 9.23C4.81 8.98 4.81 7.58 5.86 7.33C8.42 6.72 10.44 4.7 11.05 2.14Z" />
  </svg>
);

const BananaLogo = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M4 13c3.5-2 8-2 10 2a5.5 5.5 0 0 1 8 5" />
    <path d="M5.15 17a9 9 0 1 0 17.77-4.22" />
    <line x1="10" x2="15" y1="11" y2="15" />
  </svg>
);

const SoraLogo = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2L14.4 9.6H22L15.8 14.1L18.2 21.7L12 17.2L5.8 21.7L8.2 14.1L2 9.6H9.6L12 2Z" />
    <circle cx="12" cy="12" r="2" className="text-black" />
  </svg>
);



const ModelSelectorComponent: React.FC<ModelSelectorProps> = ({ selectedModel, onSelect, disabled }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { user, userInfo } = useAuth();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getModelIcon = (modelId: string) => {
    switch (modelId) {
      case 'gpt-5.2-instant': return <OpenAILogo className="w-4 h-4 text-emerald-500" />;

      case 'gemini-3-flash': return <GeminiLogo className="w-4 h-4 text-yellow-400" />;

      case 'gpt-image-1.5': return <OpenAILogo className="w-4 h-4 text-purple-400" />;
      case 'nano-banana': return <BananaLogo className="w-4 h-4 text-yellow-300" />;

      case 'sora': return <SoraLogo className="w-4 h-4 text-white" />;

      default: return <Box size={16} className="text-neutral-400" />;
    }
  };

  const isModelLocked = useCallback((modelId: string) => {
    if (!user) {
      // 비로그인: gpt-5.2-instant만 가능
      return modelId !== 'gpt-5.2-instant';
    }
    if (!userInfo) return true; // 로그인했지만 정보 없으면 잠금
    // 무료 모델은 항상 사용 가능
    if (modelId === 'gpt-5.2-instant') return false;
    // 프리미엄 기능은 멤버십 필요
    return !(userInfo.can_use_premium_features ?? false);
  }, [user, userInfo]);

  const groupedModels = useMemo(() => {
    return MODELS.reduce((acc, model) => {
      if (!acc[model.category]) acc[model.category] = [];
      acc[model.category].push(model);
      return acc;
    }, {} as Record<ModelCategory, AIModel[]>);
  }, []);

  const categories: ModelCategory[] = useMemo(() => ['GPT', 'Gemini', 'Image', 'Video'], []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className="flex items-center space-x-2 px-3 py-2 rounded-lg hover:bg-neutral-800 transition-colors text-sm font-medium text-neutral-300 border border-transparent hover:border-neutral-700 focus:outline-none"
      >
        <div className="flex items-center space-x-2">
          {getModelIcon(selectedModel.id)}
          <span>{selectedModel.name}</span>
        </div>
        <ChevronDown size={14} className={`text-neutral-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      <div
        className={`absolute bottom-full left-0 mb-2 w-64 bg-[#0a0a0a] border border-neutral-800 rounded-xl shadow-2xl overflow-hidden transition-all duration-200 origin-bottom-left z-50 ${isOpen ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-2 pointer-events-none'}`}
      >
        <div className="max-h-80 overflow-y-auto custom-scrollbar p-2 space-y-3">
          {categories.map((category) => (
            <div key={category}>
              {groupedModels[category]?.length > 0 && (
                <>
                  <div className="px-2 py-1 text-[10px] font-bold text-neutral-500 uppercase tracking-wider flex items-center space-x-1 border-b border-neutral-800/50 mb-1 pb-1">
                    <span>{category} 시리즈</span>
                  </div>
                  <div className="mt-1 space-y-1">
                    {groupedModels[category]?.map((model) => {
                      const locked = isModelLocked(model.id);
                      return (
                        <button
                          key={model.id}
                          onClick={() => {
                            if (locked) return;
                            onSelect(model);
                            setIsOpen(false);
                          }}
                          disabled={locked}
                          className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between group 
                            ${selectedModel.id === model.id ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200'}
                            ${locked ? 'opacity-50 cursor-not-allowed hover:bg-transparent' : ''}
                        `}
                          title={locked ? "로그인 및 멤버십 필요" : ""}
                        >
                          <div className="flex items-center space-x-2">
                            <div className="opacity-70 group-hover:opacity-100 transition-opacity">
                              {getModelIcon(model.id)}
                            </div>
                            <span className={locked ? "text-neutral-600 dark:text-neutral-500" : ""}>{model.name}</span>
                            {model.isVideo && (
                              <div className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-red-500/20 text-red-400 border border-red-500/30">
                                VIDEO
                              </div>
                            )}
                          </div>
                          <div className="flex items-center space-x-2">
                            {locked && <Lock size={12} className="text-neutral-600" />}
                            {selectedModel.id === model.id && !locked && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export const ModelSelector = memo(ModelSelectorComponent);