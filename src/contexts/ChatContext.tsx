import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Message, AIModel, ChatSession, PromptTemplate } from '../types';
import { VideoOptions } from '../components/chat/VideoOptions';
import { MODELS } from '../constants/models';
import { aiService } from '../services/aiService';
import { chatApi } from '../services/chatApi';
import { useFolder } from './FolderContext';
import { useAuth } from './AuthContext';
import { toast } from 'sonner';

interface ChatContextType {
    // Current Chat State
    messages: Message[];
    inputValue: string;
    setInputValue: (val: string) => void;
    selectedModel: AIModel;
    setSelectedModel: (model: AIModel) => void;
    isLoading: boolean;
    hasStarted: boolean;

    // Session State
    currentSessionId: string | null;
    activeFolderId: string | null; // If null, it's a loose chat
    recentChats: ChatSession[];

    // Video Options
    videoOptions: VideoOptions;
    setVideoOptions: (options: VideoOptions) => void;

    // Actions
    sendMessage: (overridePrompt?: string) => Promise<void>;
    stopGeneration: () => void;
    resetChat: () => void;
    loadChatSession: (sessionId: string, folderId?: string) => void;
    deleteChat: (sessionId: string, folderId?: string) => void;

    // System Instruction (Persona)
    systemInstruction: string | undefined;
    setSystemInstruction: (instruction: string | undefined) => void;
}

const ChatContext = createContext<ChatContextType | null>(null);

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { addChatToFolder, updateFolderChat, folderChats, removeChatFromFolder } = useFolder();

    // Persisted Recent Chats (사용자별로 분리)
    const [recentChats, setRecentChats] = useState<ChatSession[]>([]);

    // 사용자 변경 시 초기화 및 최근 채팅 DB 로드
    useEffect(() => {
        if (!user) {
            setMessages([]);
            setRecentChats([]);
            setCurrentSessionId(null);
            setActiveFolderId(null);
            setHasStarted(false);
            return;
        }
        let ok = true;
        (async () => {
            try {
                const list = await chatApi.getChats(null);
                if (!ok) return;
                setRecentChats(list);
            } catch (e) {
                console.error('Failed to load recent chats:', e);
                setRecentChats([]);
            }
        })();
        return () => { ok = false; };
    }, [user?.uid]);

    // Current Chat UI State
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [selectedModel, setSelectedModel] = useState<AIModel>(MODELS[0]);
    const [systemInstruction, setSystemInstruction] = useState<string | undefined>(undefined);
    const [isLoading, setIsLoading] = useState(false);
    const [hasStarted, setHasStarted] = useState(false);
    const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
    const [activeFolderId, setActiveFolderId] = useState<string | null>(null);

    // Video Options State
    const [videoOptions, setVideoOptions] = useState<VideoOptions>({
        duration: '10s',
        resolution: '1080p',
        style: 'realistic',
        aspectRatio: '16:9'
    });

    const abortControllerRef = useRef<AbortController | null>(null);

    const recentPersistRef = useRef<ReturnType<typeof setTimeout> | null>(null);


    useEffect(() => {
        if (!currentSessionId || messages.length === 0) return;

        const now = Date.now();
        const sessionUpdate = {
            messages,
            lastModified: now,
            modelId: selectedModel.id,
            systemInstruction
        };

        if (activeFolderId) {
            updateFolderChat(activeFolderId, currentSessionId, sessionUpdate);
        } else {
            setRecentChats(prev => prev.map(c =>
                c.id === currentSessionId ? { ...c, ...sessionUpdate } : c
            ));
            if (recentPersistRef.current) clearTimeout(recentPersistRef.current);
            recentPersistRef.current = setTimeout(async () => {
                recentPersistRef.current = null;
                try {
                    await chatApi.updateChat(currentSessionId, {
                        messages: sessionUpdate.messages as any,
                        model_id: selectedModel.id,
                        system_instruction: systemInstruction ?? ''
                    });
                } catch (e) {
                    console.warn('Failed to persist recent chat:', e);
                }
            }, 1500);
        }
        return () => {
            if (recentPersistRef.current) {
                clearTimeout(recentPersistRef.current);
                recentPersistRef.current = null;
            }
        };
    }, [messages, currentSessionId, activeFolderId, selectedModel, systemInstruction, updateFolderChat]);

    const stopGeneration = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
            setIsLoading(false);
            // Mark last streaming message as done
            setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last && last.role === 'model' && last.isStreaming) {
                    return prev.map(m => m.id === last.id ? { ...m, isStreaming: false, content: m.content + " [중단됨]" } : m);
                }
                return prev;
            });
            toast.info("생성이 중단되었습니다.");
        }
    };

    const resetChat = () => {
        stopGeneration();
        setMessages([]);
        setInputValue('');
        setHasStarted(false);
        setIsLoading(false);
        setCurrentSessionId(null);
        setActiveFolderId(null);
        setSelectedModel(MODELS[0]);
        setSystemInstruction(undefined); // Persona sets this again if needed via useEffect in App
    };

    const loadChatSession = (sessionId: string, folderId?: string) => {
        stopGeneration();

        let session: ChatSession | undefined;

        if (folderId) {
            session = folderChats[folderId]?.find(c => c.id === sessionId);
        } else {
            // First check recent chats
            session = recentChats.find(c => c.id === sessionId);

            // If not found, search in all folders
            if (!session) {
                for (const [fId, chats] of Object.entries(folderChats)) {
                    const found = (chats as ChatSession[]).find(c => c.id === sessionId);
                    if (found) {
                        session = found;
                        folderId = fId; // Found the folder ID
                        break;
                    }
                }
            }
        }

        if (session) {
            setMessages(session.messages);
            setHasStarted(session.messages.length > 0);
            setSystemInstruction(session.systemInstruction);
            setCurrentSessionId(session.id);
            setActiveFolderId(folderId || null);

            const model = MODELS.find(m => m.id === session!.modelId) || MODELS[0];
            setSelectedModel(model);
            setInputValue('');
        } else {
            toast.error("채팅 세션을 찾을 수 없습니다.");
            navigate('/'); // Redirect to home if not found
        }
    };

    const deleteChat = async (sessionId: string, folderId?: string) => {
        if (currentSessionId === sessionId) resetChat();
        try {
            if (folderId) {
                await removeChatFromFolder(folderId, sessionId);
            } else {
                await chatApi.deleteChat(sessionId);
                setRecentChats(prev => prev.filter(c => c.id !== sessionId));
            }
            toast.info('채팅이 삭제되었습니다.');
        } catch (e: any) {
            toast.error(e?.message || '채팅 삭제에 실패했습니다.');
        }
    };

    const sendMessage = async (overridePrompt?: string) => {
        const promptToSend = overridePrompt || inputValue;
        if (!promptToSend.trim() || isLoading) return;

        // 로그인 확인 (DB 저장 필요)
        if (!user) {
            toast.error('로그인이 필요한 기능입니다.');
            return;
        }

        let effectiveSessionId = currentSessionId;
        // Create New Session if needed (DB에 저장)
        if (!currentSessionId) {
            const title = promptToSend.slice(0, 30) + (promptToSend.length > 30 ? '...' : '');
            try {
                const c = await chatApi.createChat({
                    title,
                    folder_id: activeFolderId || undefined,
                    messages: [],
                    model_id: selectedModel.id,
                    system_instruction: systemInstruction ?? ''
                });
                effectiveSessionId = c.id;
                setCurrentSessionId(c.id);
                if (activeFolderId) {
                    addChatToFolder(activeFolderId, c);
                } else {
                    setRecentChats(prev => [c, ...prev]);
                }
                navigate(`/chat/${c.id}`);
            } catch (e: any) {
                toast.error(e?.message || '채팅을 만들 수 없습니다.');
                return;
            }
        }

        setHasStarted(true);

        // Add User Message
        const userMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: promptToSend,
            type: 'text',
            timestamp: Date.now()
        };
        setMessages(prev => [...prev, userMessage]);
        setInputValue('');
        setIsLoading(true);

        // Abort Controller Setup
        abortControllerRef.current = new AbortController();
        const signal = abortControllerRef.current.signal;

        const botMessageId = (Date.now() + 1).toString();
        const addBotPlaceholder = (type: 'text' | 'image' | 'video', content: string) => {
            setMessages(prev => [...prev, {
                id: botMessageId,
                role: 'model',
                content,
                type,
                timestamp: Date.now(),
                isStreaming: true,
                ...(type === 'video' && { progress: 0, estimatedTime: '3분' })
            }]);
        };

        try {
            if (selectedModel.isVideo) {
                addBotPlaceholder('video', `비디오 생성 중... (${videoOptions.duration}, ${videoOptions.resolution}, ${videoOptions.style})`);

                // Simulate progress updates for video generation
                const progressInterval = setInterval(() => {
                    setMessages(prev => prev.map(m => {
                        if (m.id === botMessageId && m.progress !== undefined) {
                            const newProgress = Math.min(m.progress + Math.random() * 15, 95);
                            const estimatedTime = newProgress < 50 ? '2분' : newProgress < 80 ? '1분' : '30초';
                            return { ...m, progress: newProgress, estimatedTime };
                        }
                        return m;
                    }));
                }, 2000);

                try {
                    // Pass user to backend for permission check
                    const videoUrl = await aiService.generateVideo(selectedModel, promptToSend, videoOptions, user, signal);
                    clearInterval(progressInterval);

                    if (signal.aborted) return;

                    setMessages(prev => prev.map(m => m.id === botMessageId ? {
                        ...m,
                        mediaUrl: videoUrl || undefined,
                        content: videoUrl ? '비디오가 생성되었습니다.' : '실패했습니다.',
                        isStreaming: false,
                        progress: 100,
                        estimatedTime: undefined
                    } : m));

                    // Add to video generations history if successful
                    if (videoUrl) {
                        const videoGeneration = {
                            id: botMessageId,
                            prompt: promptToSend,
                            videoUrl,
                            options: videoOptions,
                            createdAt: Date.now(),
                            modelId: selectedModel.id
                        };

                        // Update current session with video generation
                        if (activeFolderId && effectiveSessionId) {
                            updateFolderChat(activeFolderId, effectiveSessionId, {
                                videoGenerations: [
                                    ...(folderChats[activeFolderId]?.find(c => c.id === effectiveSessionId)?.videoGenerations || []),
                                    videoGeneration
                                ]
                            });
                        } else if (effectiveSessionId) {
                            setRecentChats(prev => prev.map(c =>
                                c.id === effectiveSessionId
                                    ? { ...c, videoGenerations: [...(c.videoGenerations || []), videoGeneration] }
                                    : c
                            ));
                        }
                    }
                } catch (error) {
                    clearInterval(progressInterval);
                    setMessages(prev => prev.map(m => m.id === botMessageId ? {
                        ...m,
                        content: '비디오 생성 중 오류가 발생했습니다. (권한 또는 API 오류)',
                        isStreaming: false,
                        progress: undefined,
                        estimatedTime: undefined
                    } : m));
                    throw error;
                }
            } else if (selectedModel.isImage) {
                addBotPlaceholder('image', '이미지 생성 중...');
                const imageUrl = await aiService.generateImage(selectedModel, promptToSend, user, signal);
                if (signal.aborted) return;
                setMessages(prev => prev.map(m => m.id === botMessageId ? {
                    ...m, mediaUrl: imageUrl || undefined, content: imageUrl ? '이미지가 생성되었습니다.' : '실패했습니다.', type: 'image', isStreaming: false
                } : m));
            } else {
                addBotPlaceholder('text', '');
                let fullText = '';
                // Pass user to backend for permission check
                const stream = aiService.generateTextStream(selectedModel, promptToSend, messages, systemInstruction, user, signal);

                for await (const chunk of stream) {
                    if (signal.aborted) break;
                    fullText += chunk;
                    setMessages(prev => prev.map(m => m.id === botMessageId ? { ...m, content: fullText } : m));
                }
                if (!signal.aborted) {
                    setMessages(prev => prev.map(m => m.id === botMessageId ? { ...m, isStreaming: false } : m));
                }
            }
        } catch (error: any) {
            if (error.name !== 'AbortError') {
                console.error(error);
                const errorMessage = error.message === "Standard Membership Required"
                    ? "이 모델을 사용하려면 스탠다드 멤버십이 필요합니다."
                    : error.message || "오류가 발생했습니다.";

                setMessages(prev => prev.map(m => m.id === botMessageId ? { ...m, content: `[${errorMessage}]`, isStreaming: false } : m));
                toast.error("메시지 전송 실패", { description: errorMessage });
            }
        } finally {
            setIsLoading(false);
            abortControllerRef.current = null;
        }
    };

    return (
        <ChatContext.Provider value={{
            messages,
            inputValue,
            setInputValue,
            selectedModel,
            setSelectedModel,
            isLoading,
            hasStarted,
            currentSessionId,
            activeFolderId,
            recentChats,
            videoOptions,
            setVideoOptions,
            sendMessage,
            stopGeneration,
            resetChat,
            loadChatSession,
            deleteChat,
            systemInstruction,
            setSystemInstruction
        }}>
            {children}
        </ChatContext.Provider>
    );
};

export const useChatContext = () => {
    const context = useContext(ChatContext);
    if (!context) throw new Error('useChatContext must be used within a ChatProvider');
    return context;
};