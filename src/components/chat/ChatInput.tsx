import React, { useRef, useEffect, useState } from 'react';
import { ArrowUp, AlertCircle, X, Sparkles, ChevronRight, Square } from 'lucide-react';
import { ModelSelector } from './ModelSelector';
import { VideoOptions, VideoOptions as VideoOptionsType } from './VideoOptions';
import { VideoCreationStudio } from './VideoCreationStudio';
import { MembershipModal } from '@/components/membership/MembershipModal';
import { useAuth } from '@/contexts/AuthContext';
import { MODELS } from '@/constants/models';
import { AIModel, PromptTemplate } from '@/types';

interface ChatInputProps {
    inputValue: string;
    onInputChange: (value: string) => void;
    onSend: () => void;
    onStop?: () => void;
    isLoading: boolean;
    selectedModel: AIModel;
    onModelSelect: (model: AIModel) => void;
    widthStyle: React.CSSProperties;
    hasStarted: boolean;
    prompts: PromptTemplate[];
    videoOptions?: VideoOptionsType;
    onVideoOptionsChange?: (options: VideoOptionsType) => void;
    recommendedPrompts?: string[];
    showRecommendedPrompts?: boolean;
    onCloseRecommendedPrompts?: () => void;
}

export const ChatInput: React.FC<ChatInputProps> = ({
    inputValue,
    onInputChange,
    onSend,
    onStop,
    isLoading,
    selectedModel,
    onModelSelect,
    widthStyle,
    hasStarted,
    prompts,
    videoOptions,
    onVideoOptionsChange,
    recommendedPrompts,
    showRecommendedPrompts = false,
    onCloseRecommendedPrompts
}) => {
    const { user, userInfo } = useAuth();
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const [showWarning, setShowWarning] = useState(false);
    const [showPrompts, setShowPrompts] = useState(false);
    const [showMembershipModal, setShowMembershipModal] = useState(false);
    const [requiredFeature, setRequiredFeature] = useState<string>();
    const promptMenuRef = useRef<HTMLDivElement>(null);

    // 모델 사용 가능 여부 확인
    const canUseModel = (model: AIModel): boolean => {
        if (!user) {
            // 비로그인: gpt-5.2-instant만 가능
            return model.id === 'gpt-5.2-instant';
        }
        if (!userInfo) return false;
        // 로그인: 멤버십 확인
        if (model.id === 'gpt-5.2-instant') return true; // 무료 모델
        return userInfo.can_use_premium_features ?? false;
    };

    const handleSend = () => {
        if (!canUseModel(selectedModel)) {
            const modelName = selectedModel.name;
            setRequiredFeature(`${modelName} 사용`);
            setShowMembershipModal(true);
            return;
        }
        onSend();
    };

    // Video Options State
    const defaultVideoOptions: VideoOptionsType = {
        duration: '10s',
        resolution: '1080p',
        style: 'realistic',
        aspectRatio: '16:9'
    };

    const currentVideoOptions = videoOptions || defaultVideoOptions;

    useEffect(() => {
        if (!isLoading) {
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isLoading]);

    // Handle click outside for prompt menu
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (promptMenuRef.current && !promptMenuRef.current.contains(event.target as Node)) {
                setShowPrompts(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Auto-resize textarea
    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.style.height = 'auto';
            inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 200)}px`;
        }
    }, [inputValue]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.nativeEvent.isComposing) return;
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleModelSelect = (model: AIModel) => {
        if (!canUseModel(model)) {
            setRequiredFeature(`${model.name} 사용`);
            setShowMembershipModal(true);
            return;
        }
        if (hasStarted && model.id !== selectedModel.id) {
            setShowWarning(true);
        }
        onModelSelect(model);
    };

    const handlePromptClick = (content: string) => {
        onInputChange(content);
        setShowPrompts(false);
        setTimeout(() => {
            if (inputRef.current) {
                inputRef.current.style.height = 'auto';
                inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 200)}px`;
                inputRef.current.focus();
            }
        }, 50);
    };

    // If a video model is selected, render the Video Creation Studio
    if (selectedModel.isVideo) {
        return (
            <div
                className={`fixed z-20 transition-all duration-700 ease-[cubic-bezier(0.25,0.1,0.25,1)] bottom-0 flex justify-center items-end`}
                style={{ ...widthStyle, height: 'auto', paddingBottom: '0' }}
            >
                <div className="w-full max-w-[1600px] px-6 relative z-10 pb-0">
                    <VideoCreationStudio
                        inputValue={inputValue}
                        onInputChange={onInputChange}
                        onSend={handleSend}
                        isLoading={isLoading}
                        selectedModel={selectedModel}
                        onModelSelect={handleModelSelect}
                        videoOptions={currentVideoOptions}
                        onVideoOptionsChange={onVideoOptionsChange || (() => { })}
                        onClose={() => {
                            const freeModel = MODELS.find(m => m.id === 'gpt-5.2-instant') || selectedModel;
                            handleModelSelect(freeModel);
                        }}
                    />
                </div>

                {/* Immersive Background Blur Overlay */}
                <div className="fixed inset-0 bg-black/80 backdrop-blur-md -z-10 animate-fade-in pointer-events-none" />
            </div>
        );
    }

    return (
        <div
            className={`fixed z-20 transition-all duration-700 ease-in-out ${hasStarted ? 'bottom-0' : 'bottom-2 md:bottom-6'}`}
            style={widthStyle}
        >
            {/* Gradient Backdrop for Fade Effect */}
            <div
                className={`absolute bottom-0 left-0 right-0 z-0 pointer-events-none transition-all duration-500 ease-in-out
bg-gradient-to-t from-[#050505] via-[#050505]/80 to-transparent backdrop-blur-[2px]
${hasStarted ? 'h-32 opacity-100' : 'h-0 opacity-0'}`}
/>

            {/* Content Wrapper */}
            <div className={`max-w-5xl mx-auto px-4 relative z-10 ${hasStarted ? 'pb-2' : ''}`}>

                {/* Warning Popup */}
                <div
                    className={`absolute bottom-full left-4 right-4 mb-4 bg-[#1a1a1a] border border-neutral-800 rounded-xl p-4 shadow-2xl backdrop-blur-md transform transition-all duration-500 origin-bottom z-30 flex items-start gap-3
                ${showWarning ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-4 scale-95 pointer-events-none'}`}
                >
                    <div className="shrink-0 text-yellow-500 mt-0.5">
                        <AlertCircle size={20} />
                    </div>
                    <div className="flex-1 mr-2">
                        <h4 className="text-sm font-semibold text-neutral-200 mb-1">모델 변경 주의</h4>
                        <p className="text-xs text-neutral-400 leading-relaxed">
                            모델을 변경하면 대화의 <strong>맥락이 어색</strong>해질 수 있으며, 누적된 대화 내역을 전송하는 과정에서 <strong>추가 크레딧(토큰)이 소모</strong>될 수 있습니다.
                        </p>
                    </div>
                    <button onClick={() => setShowWarning(false)} className="shrink-0 text-neutral-500 hover:text-white transition-colors">
                        <X size={16} />
                    </button>
                </div>

                {/* Recommended Prompts */}
                {showRecommendedPrompts && recommendedPrompts && recommendedPrompts.length > 0 && (
                    <div className="absolute bottom-full left-4 right-4 mb-4 bg-white dark:bg-neutral-900 rounded-xl p-4 border border-blue-200/50 dark:border-blue-800/50 shadow-2xl z-30">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center space-x-2">
                                <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                    </svg>
                                </div>
                                <span className="text-sm font-semibold text-blue-900 dark:text-blue-100">💡 추천 시작 프롬프트</span>
                            </div>
                            {onCloseRecommendedPrompts && (
                                <button
                                    onClick={onCloseRecommendedPrompts}
                                    className="p-1.5 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 transition-colors"
                                    title="닫기"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            )}
                        </div>
                        <div className="grid gap-2">
                            {recommendedPrompts.map((prompt, index) => (
                                <button
                                    key={index}
                                    onClick={() => {
                                        onInputChange(prompt);
                                        // Auto-focus to input
                                        setTimeout(() => {
                                            if (inputRef.current) {
                                                inputRef.current.style.height = 'auto';
                                                inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 200)}px`;
                                                inputRef.current.focus();
                                            }
                                        }, 100);
                                    }}
                                    className="text-left p-3 bg-white dark:bg-neutral-800 rounded-lg border border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:border-blue-300 dark:hover:border-blue-700 transition-all duration-200 group"
                                    disabled={isLoading}
                                >
                                    <div className="flex items-start space-x-2">
                                        <span className="text-blue-500 dark:text-blue-400 font-mono text-xs mt-0.5 opacity-70">
                                            {index + 1}
                                        </span>
                                        <span className="text-sm text-gray-700 dark:text-gray-300 group-hover:text-blue-900 dark:group-hover:text-blue-100">
                                            {prompt}
                                        </span>
                                    </div>
                                </button>
                            ))}
                        </div>
                        <div className="mt-3 text-xs text-blue-600 dark:text-blue-400 opacity-70">
                            💭 위 프롬프트 중 하나를 클릭하거나, 자유롭게 질문을 시작해보세요!
                        </div>
                    </div>
                )}

                {/* Prompt Menu */}
                <div
                    ref={promptMenuRef}
                    className={`absolute bottom-full left-4 mb-2 w-72 max-w-[85vw] bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl shadow-2xl overflow-hidden transition-all duration-200 origin-bottom-left z-30
                ${showPrompts ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-2 pointer-events-none'}`}
                >
                    <div className="flex flex-col max-h-[400px]">
                        <div className="px-4 py-3 bg-neutral-900/50 border-b border-neutral-800">
                            <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-2">
                                <Sparkles size={12} className="text-indigo-400" />
                                프롬프트 라이브러리
                            </span>
                        </div>
                        <div className="overflow-y-auto custom-scrollbar p-2 space-y-1">
                            {prompts.length === 0 ? (
                                <div className="p-4 text-center text-xs text-neutral-500">저장된 템플릿이 없습니다.</div>
                            ) : (
                                prompts.map((item) => (
                                    <button
                                        key={item.id}
                                        onClick={() => handlePromptClick(item.content)}
                                        className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-neutral-800 group transition-all flex items-start justify-between border border-transparent hover:border-neutral-700/50"
                                    >
                                        <div className="flex-1 min-w-0 mr-2">
                                            <div className="flex items-center gap-2 mb-0.5">
                                                {item.isDefault && <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-indigo-500/50" />}
                                                <span className="text-sm text-neutral-300 group-hover:text-white font-medium truncate">{item.title}</span>
                                            </div>
                                            <span className="text-[10px] text-neutral-500 group-hover:text-neutral-400 line-clamp-1">{item.description}</span>
                                        </div>
                                        <ChevronRight size={14} className="text-neutral-600 group-hover:text-neutral-400 mt-1" />
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                <div
                    className={`relative bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 transition-all duration-300 rounded-2xl flex flex-col p-2 ${isLoading ? 'shadow-2xl shadow-neutral-900/20 dark:shadow-neutral-900/40' : 'shadow-sm'}`}
                    style={isLoading ? {
                        boxShadow: `0 0 30px var(--point-bg), 0 20px 40px rgba(0,0,0,0.15)`,
                        borderColor: 'var(--point-color)',
                        borderWidth: '1px'
                    } : {}}
                >
                    <textarea
                        ref={inputRef}
                        value={inputValue}
                        onChange={(e) => onInputChange(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="WEAV AI에게 메시지 보내기..."
                        className="w-full bg-transparent text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-neutral-500 px-3 py-3 focus:outline-none text-base font-normal resize-none overflow-y-auto custom-scrollbar"
                        style={{
                            minHeight: '48px',
                            maxHeight: '200px'
                        }}
                        rows={1}
                        disabled={isLoading}
                    />

                    <div className="flex items-center justify-between px-2 pt-2 pb-1">
                        <div className="flex flex-wrap items-center gap-2">
                            <ModelSelector selectedModel={selectedModel} onSelect={handleModelSelect} disabled={isLoading} />

                            {/* Video Options - Only shown via popover now, but logic remains if we want to revert */}
                            {selectedModel.isVideo && (
                                <VideoOptions
                                    model={selectedModel}
                                    options={currentVideoOptions}
                                    onOptionsChange={onVideoOptionsChange || (() => { })}
                                    disabled={isLoading}
                                />
                            )}

                            <button
                                onClick={() => setShowPrompts(!showPrompts)}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all duration-200
                                ${showPrompts ? 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30' : 'bg-neutral-900 text-neutral-400 border-neutral-800 hover:text-white hover:border-neutral-700'}
                            `}
                            >
                                <Sparkles size={14} className={showPrompts ? "text-indigo-400" : ""} />
                                <span className="hidden sm:inline">프롬프트 불러오기</span>
                                <span className="sm:hidden">프롬프트</span>
                            </button>
                        </div>

                        <div className="flex items-center gap-2">
                            {isLoading && onStop && (
                                <button
                                    onClick={onStop}
                                    className="p-2 rounded-lg bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-white transition-colors"
                                    title="생성 중단"
                                >
                                    <Square size={16} fill="currentColor" />
                                </button>
                            )}
                            <button
                                onClick={handleSend}
                                disabled={!inputValue.trim() || isLoading}
                                className={`p-2 rounded-lg transition-all duration-200 shrink-0 ${inputValue.trim() && !isLoading ? 'text-white hover:opacity-90 hover:scale-105' : 'bg-neutral-800 text-neutral-600 cursor-not-allowed'} ${isLoading ? 'animate-pulse' : ''}`}
                                style={inputValue.trim() && !isLoading ? {
                                    backgroundColor: 'var(--point-color)',
                                    boxShadow: '0 0 20px var(--point-bg)',
                                } : {}}
                            >
                                {isLoading ? (
                                    <div className="relative w-5 h-5">
                                        <div className="absolute inset-0 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        <div className="absolute inset-1 border-2 border-transparent border-t-current rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '0.8s' }} />
                                    </div>
                                ) : <ArrowUp size={20} />}
                            </button>
                        </div>
                    </div>
                </div>

                <div className={`text-center mt-3 transition-opacity duration-500 ${hasStarted ? 'opacity-50' : 'opacity-100'}`}>
                    <p className="text-[10px] text-neutral-600">
                        WEAV AI는 인물, 장소 또는 사실에 대한 부정확한 정보를 제공할 수 있습니다.
                    </p>
                </div>
            </div>

            <MembershipModal
                isOpen={showMembershipModal}
                onClose={() => setShowMembershipModal(false)}
                requiredFeature={requiredFeature}
            />
        </div>
    );
};