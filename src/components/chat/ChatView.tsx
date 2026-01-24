import React, { useRef, useEffect, useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { ChatMessage } from './ChatMessage';
import { WelcomeScreen } from './WelcomeScreen';
import { ChatInput } from './ChatInput';
import { useChatContext } from '../../contexts/ChatContext';
import { useFolder } from '../../contexts/FolderContext';
import { PromptTemplate } from '../../types';

interface ChatViewProps {
    hasStarted: boolean;
    contentStyle: React.CSSProperties;
    allPrompts: PromptTemplate[];
}

export const ChatView: React.FC<ChatViewProps> = ({
    hasStarted: initialHasStarted,
    contentStyle,
    allPrompts
}) => {
    const { id } = useParams<{ id: string }>();
    const {
        messages, inputValue, setInputValue, selectedModel, setSelectedModel,
        isLoading, sendMessage, stopGeneration, loadChatSession, currentSessionId, hasStarted,
        videoOptions, setVideoOptions
    } = useChatContext();

    const [showPrompts, setShowPrompts] = useState(true);

    // Get current session for recommended prompts
    const { folderChats, recentChats } = useFolder();
    const currentSession = useMemo(() => {
        if (!currentSessionId) return null;
        if (id) {
            // Find in folder chats
            for (const folderId of Object.keys(folderChats)) {
                const chat = folderChats[folderId]?.find(c => c.id === id);
                if (chat) return chat;
            }
        }
        return recentChats.find(c => c.id === currentSessionId) || null;
    }, [currentSessionId, id, folderChats, recentChats]);

    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (id && id !== currentSessionId) {
            loadChatSession(id);
        }
    }, [id, currentSessionId, loadChatSession]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    return (
        <>
            <main className="flex-1 w-full max-w-5xl mx-auto flex flex-col relative z-10">
                {!hasStarted ? (
                    <WelcomeScreen />
                ) : (
                    <div className="flex-1 overflow-y-auto px-4 pt-20 pb-40 custom-scrollbar">
                        {messages.map((msg) => (
                            <ChatMessage key={msg.id} message={msg} />
                        ))}
                        <div ref={messagesEndRef} />
                    </div>
                )}
            </main>

            <ChatInput
                inputValue={inputValue}
                onInputChange={setInputValue}
                onSend={() => sendMessage()}
                onStop={isLoading ? stopGeneration : undefined}
                isLoading={isLoading}
                selectedModel={selectedModel}
                onModelSelect={setSelectedModel}
                hasStarted={hasStarted}
                widthStyle={contentStyle}
                prompts={allPrompts}
                videoOptions={videoOptions}
                onVideoOptionsChange={setVideoOptions}
                recommendedPrompts={hasStarted && messages.length === 1 ? currentSession?.recommendedPrompts : undefined}
                showRecommendedPrompts={hasStarted && messages.length === 1 && showPrompts && !!currentSession?.recommendedPrompts}
                onCloseRecommendedPrompts={() => setShowPrompts(false)}
            />
        </>
    );
};