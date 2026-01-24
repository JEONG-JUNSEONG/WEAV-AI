import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Folder, ChatSession } from '../types';
import { aiService } from '../services/aiService';
import { chatApi } from '../services/chatApi';
import { useAuth } from './AuthContext';
import { toast } from 'sonner';

// Helper functions for AI folder generation
type StepLike = { title: string; modelId: string; systemInstruction: string };
const generateWelcomeMessage = (step: StepLike, projectName: string): string => {
    const modelNames: Record<string, string> = {
        'gpt-5.2-instant': 'ChatGPT 5.2 Instant',
        'gemini-3-flash': 'Gemini 3 Flash',
        'gpt-image-1.5': 'GPT Image 1.5',
        'nano-banana': 'Nano Banana',
        'sora': 'SORA'
    };

    const modelDescriptions: Record<string, string> = {
        'gpt-5.2-instant': '빠르고 효율적인 텍스트 생성에 특화된 모델로, 전략 수립과 계획 수립에 최적화되어 있습니다.',
        'gemini-3-flash': '데이터 분석과 종합적인 판단력이 뛰어난 모델로, 종목 선정과 세부 계획 수립에 강점이 있습니다.',
        'gpt-image-1.5': '고품질 이미지 생성에 특화된 DALL-E 모델입니다.',
        'nano-banana': '빠른 이미지 생성과 일러스트레이션에 특화된 모델입니다.',
        'sora': '혁신적인 동영상 생성 AI로, 창의적인 비디오 콘텐츠 제작에 최적화되어 있습니다.'
    };

    const baseMessage = `🎯 **${projectName}** 프로젝트의 **${step.title}** 단계에 오신 것을 환영합니다!

🤖 **사용 모델:** ${modelNames[step.modelId] ?? step.modelId}
📝 **모델 특징:** ${modelDescriptions[step.modelId] ?? '범용 AI 모델입니다.'}

💡 **작업 개요:**
${step.systemInstruction}

✨ **시작하기 전에:**
아래 추천 프롬프트를 참고하여 대화를 시작해보세요. 각 프롬프트는 이 단계의 작업에 특화되어 설계되었습니다.`;

    return baseMessage;
};

const generateRecommendedPrompts = (step: any, projectName: string): string[] => {
    // 작업 제목과 프로젝트명을 기반으로 스마트한 프롬프트 생성
    const title = step.title.toLowerCase();
    const project = projectName.toLowerCase();

    // 각 모델별 특성에 맞는 프롬프트 템플릿
    const promptTemplates: Record<string, (context: { title: string, project: string }) => string[]> = {
        'gpt-5.2-instant': ({ title, project }) => {
            if (title.includes('투자') || title.includes('전략') || title.includes('계획')) {
                return [
                    `"${project}" 프로젝트의 구체적인 실행 전략을 단계별로 수립해주세요`,
                    `현재 시장 상황을 고려하여 ${title} 작업의 리스크와 기회를 분석해주세요`,
                    `${title} 작업에서 고려해야 할 핵심 포인트들을 정리해주세요`
                ];
            }
            if (title.includes('분석') || title.includes('연구')) {
                return [
                    `${project} 관련 최신 데이터를 분석하여 인사이트를 도출해주세요`,
                    `객관적인 데이터에 기반한 ${title} 결과를 제시해주세요`,
                    `${title} 작업의 타당성을 검증할 수 있는 방법들을 알려주세요`
                ];
            }
            return [
                `${project} 프로젝트의 ${title} 작업에 대한 전문적인 조언을 해주세요`,
                `효율적인 방법으로 ${title} 작업을 수행하기 위한 전략을 알려주세요`,
                `${title} 작업의 단계별 실행 계획을 세워주세요`
            ];
        },

        'gemini-3-flash': ({ title, project }) => {
            if (title.includes('종목') || title.includes('선정') || title.includes('선택')) {
                return [
                    `"${project}" 목표에 맞는 최적의 옵션들을 추천해주세요`,
                    `데이터 기반으로 ${title} 작업의 타당성을 분석해주세요`,
                    `${title} 작업에서 고려해야 할 다양한 관점들을 제시해주세요`
                ];
            }
            if (title.includes('로드맵') || title.includes('계획') || title.includes('구성')) {
                return [
                    `${project} 프로젝트의 장기적 로드맵을 설계해주세요`,
                    `실행 가능한 ${title} 계획을 구체적으로 작성해주세요`,
                    `${title} 작업의 단계별 세부 사항들을 정리해주세요`
                ];
            }
            return [
                `${project} 프로젝트의 ${title} 작업에 대한 종합적인 분석을 해주세요`,
                `다양한 관점에서 ${title} 작업을 검토하고 최적안을 제시해주세요`,
                `${title} 작업의 실행 가능성과 예상 결과를 평가해주세요`
            ];
        },

        'gpt-image-1.5': ({ title, project }) => [
            `"${project}" 프로젝트의 ${title} 작업을 시각적으로 표현해주세요`,
            `${title} 작업의 결과를 그래픽으로 만들어주세요`,
            `${project} 관련 시각 자료를 고화질로 생성해주세요`
        ],

        'nano-banana': ({ title, project }) => [
            `${project} 프로젝트의 ${title} 작업을 위한 간단한 시각 자료를 만들어주세요`,
            `${title} 작업에 필요한 아이콘이나 심볼을 디자인해주세요`,
            `${project} 관련 아이디어를 시각적으로 표현해주세요`
        ],

        'sora': ({ title, project }) => [
            `"${project}" 프로젝트의 ${title} 작업을 동영상으로 만들어주세요`,
            `${title} 작업의 과정을 영상으로 시각화해주세요`,
            `${project} 관련 스토리를 동영상 콘텐츠로 제작해주세요`
        ]
    };

    const generatePrompts = promptTemplates[step.modelId];
    if (generatePrompts) {
        return generatePrompts({ title, project });
    }

    // 기본 프롬프트 (모델이 매핑되지 않은 경우)
    return [
        `${project} 프로젝트의 ${title} 작업에 대해 구체적으로 설명해주세요`,
        `${title} 작업을 효과적으로 수행하기 위한 방법을 알려주세요`,
        `${project} 목표 달성을 위한 ${title} 작업의 최종 결과물을 만들어주세요`
    ];
};

interface FolderContextType {
    folders: Folder[];
    folderChats: Record<string, ChatSession[]>;
    createFolder: (name: string, type: 'custom') => void | Promise<void>;
    createAIFolder: (goal: string) => Promise<void>;
    deleteFolder: (folderId: string) => void;
    addChatToFolder: (folderId: string, chat: ChatSession) => void;
    removeChatFromFolder: (folderId: string, chatId: string) => void;
    updateFolderChat: (folderId: string, chatId: string, updates: Partial<ChatSession>) => void;
    isGeneratingFolder: boolean;
}

const FolderContext = createContext<FolderContextType | null>(null);

export const FolderProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const [folders, setFolders] = useState<Folder[]>([]);
    const [folderChats, setFolderChats] = useState<Record<string, ChatSession[]>>({});
    const [isGeneratingFolder, setIsGeneratingFolder] = useState(false);
    const persistTimeoutRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

    // DB에서 폴더/폴더별 채팅 로드 (로그인 시)
    useEffect(() => {
        if (!user) {
            setFolders([]);
            setFolderChats({});
            return;
        }
        let ok = true;
        (async () => {
            try {
                const flist = await chatApi.getFolders();
                if (!ok) return;
                setFolders(flist);
                const byFolder: Record<string, ChatSession[]> = {};
                await Promise.all(
                    flist.map(async (f) => {
                        const chats = await chatApi.getChats(f.id);
                        if (!ok) return;
                        byFolder[f.id] = chats;
                    })
                );
                if (ok) setFolderChats(byFolder);
            } catch (e) {
                console.error('Failed to load folders/chats:', e);
                toast.error('폴더·채팅 목록을 불러오지 못했습니다.');
            }
        })();
        return () => { ok = false; };
    }, [user?.uid]);

    const createFolder = async (name: string, type: 'custom') => {
        if (!user) return;
        try {
            const f = await chatApi.createFolder(name, type);
            setFolders(prev => [f, ...prev]);
            setFolderChats(prev => ({ ...prev, [f.id]: [] }));
            toast.success(`'${name}' 폴더가 생성되었습니다.`);
        } catch (e: any) {
            toast.error(e?.message || '폴더 생성에 실패했습니다.');
        }
    };

    const createAIFolder = async (goal: string) => {
        if (!user) return;
        setIsGeneratingFolder(true);
        try {
            const plan = await aiService.planProjectStructure(goal, user);
            const f = await chatApi.createFolder(plan.projectName, 'shorts-workflow');
            const chats: ChatSession[] = [];

            for (let i = 0; i < plan.steps.length; i++) {
                const step = plan.steps[i];
                if (!step) continue;
                let si = step.systemInstruction;
                if (i < plan.steps.length - 1) {
                    const next = plan.steps[i + 1];
                    si += `\n\n📋 다음 단계 안내: 이 프로젝트는 총 ${plan.steps.length}단계로 구성되어 있으며, 다음 단계는 "${next?.title ?? ''}"입니다. 현재 단계의 결과를 다음 단계에서 최대한 활용할 수 있도록 체계적이고 구체적인 답변을 제공해주세요.`;
                } else {
                    si += `\n\n🎯 최종 단계: 이 프로젝트의 마지막 단계입니다. 지금까지의 모든 단계를 종합하여 완성도 높은 최종 결과를 제시해주세요.`;
                }
                const welcomeMsg = {
                    id: `welcome-${f.id}-step${i + 1}`,
                    role: 'model' as const,
                    content: generateWelcomeMessage(step, plan.projectName),
                    type: 'text' as const,
                    timestamp: Date.now()
                };
                const c = await chatApi.createChat({
                    title: step.title,
                    folder_id: f.id,
                    messages: [welcomeMsg],
                    model_id: step.modelId,
                    system_instruction: si,
                    recommended_prompts: generateRecommendedPrompts(step, plan.projectName)
                });
                chats.push({ ...c, folderId: f.id });
            }

            setFolders(prev => [f, ...prev]);
            setFolderChats(prev => ({ ...prev, [f.id]: chats }));
            toast.success('AI 프로젝트가 성공적으로 설계되었습니다.');
        } catch (e: any) {
            const msg = e?.message === '로그인이 필요한 기능입니다.' ? '로그인 후 이용 가능한 기능입니다.' : (e?.message || 'AI 프로젝트 설계 중 오류가 발생했습니다.');
            toast.error(msg);
        } finally {
            setIsGeneratingFolder(false);
        }
    };

    const deleteFolder = async (folderId: string) => {
        try {
            await chatApi.deleteFolder(folderId);
            setFolders(prev => prev.filter(f => f.id !== folderId));
            setFolderChats(prev => {
                const next = { ...prev };
                delete next[folderId];
                return next;
            });
            toast.info('폴더가 삭제되었습니다.');
        } catch (e: any) {
            toast.error(e?.message || '폴더 삭제에 실패했습니다.');
        }
    };

    const addChatToFolder = (folderId: string, chat: ChatSession) => {
        setFolderChats(prev => ({
            ...prev,
            [folderId]: [...(prev[folderId] || []), chat]
        }));
    };

    const removeChatFromFolder = async (folderId: string, chatId: string) => {
        try {
            await chatApi.deleteChat(chatId);
            setFolderChats(prev => ({
                ...prev,
                [folderId]: (prev[folderId] || []).filter(c => c.id !== chatId)
            }));
        } catch (e: any) {
            toast.error(e?.message || '채팅 삭제에 실패했습니다.');
        }
    };

    const updateFolderChat = (folderId: string, chatId: string, updates: Partial<ChatSession>) => {
        setFolderChats(prev => {
            const list = prev[folderId] || [];
            const updated = list.map(c => c.id === chatId ? { ...c, ...updates } : c);
            return { ...prev, [folderId]: updated };
        });
        const payload: Parameters<typeof chatApi.updateChat>[1] = {};
        if (updates.messages != null) payload.messages = updates.messages as any;
        if (updates.modelId != null) payload.model_id = updates.modelId;
        if (updates.systemInstruction != null) payload.system_instruction = updates.systemInstruction;
        const key = chatId;
        if (persistTimeoutRef.current[key]) clearTimeout(persistTimeoutRef.current[key]);
        persistTimeoutRef.current[key] = setTimeout(async () => {
            delete persistTimeoutRef.current[key];
            try {
                await chatApi.updateChat(chatId, payload);
            } catch (e) {
                console.warn('Failed to persist folder chat update:', e);
            }
        }, 1500);
    };

    return (
        <FolderContext.Provider value={{
            folders,
            folderChats,
            createFolder,
            createAIFolder,
            deleteFolder,
            addChatToFolder,
            removeChatFromFolder,
            updateFolderChat,
            isGeneratingFolder
        }}>
            {children}
        </FolderContext.Provider>
    );
};

export const useFolder = () => {
    const context = useContext(FolderContext);
    if (!context) throw new Error('useFolder must be used within a FolderProvider');
    return context;
};