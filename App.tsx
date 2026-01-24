import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';

import { AuthProvider } from '@/contexts/AuthContext';
import { FolderProvider, useFolder } from '@/contexts/FolderContext';
import { ChatProvider, useChatContext } from '@/contexts/ChatContext';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';

import { Sidebar } from '@/components/layout/Sidebar';
import { AppHeader } from '@/components/layout/AppHeader';
import { ChatView } from '@/components/chat/ChatView';
import { OnboardingModal } from '@/components/onboarding/OnboardingModal';
import { SettingsModal } from '@/components/settings/SettingsModal';
import { LoginView } from '@/components/auth/LoginView';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

import { DEFAULT_PROMPTS } from '@/constants/prompts';
import { useAppLogic } from '@/hooks/useAppLogic';

// Main Content Component
const MainLayout: React.FC = () => {
  const {
    isMenuOpen, setIsMenuOpen,
    showSettings, setShowSettings,
    showOnboarding, setShowOnboarding, userPersona,
    customPrompts, handleSavePrompt, handleDeletePrompt,
    handleOnboardingComplete, contentStyle
  } = useAppLogic();

  const {
    hasStarted, currentSessionId, activeFolderId, recentChats
  } = useChatContext();

  const { folderChats } = useFolder();

  // Header Title Logic
  const getCurrentChatTitle = () => {
    if (!currentSessionId) return null;
    if (activeFolderId) {
      return folderChats[activeFolderId]?.find(c => c.id === currentSessionId)?.title;
    }
    return recentChats.find(c => c.id === currentSessionId)?.title;
  };

  const currentChatTitle = getCurrentChatTitle();
  const showHeader = hasStarted || !!activeFolderId || !!currentSessionId;
  const allPrompts = [...DEFAULT_PROMPTS, ...customPrompts];

  const { theme } = useTheme();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#050505] text-gray-900 dark:text-white overflow-hidden relative font-sans flex transition-colors duration-300">
      <div className="fixed inset-0 z-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: theme === 'dark' ? 'radial-gradient(circle at 50% 50%, #333 1px, transparent 1px)' : 'radial-gradient(circle at 50% 50%, #ccc 1px, transparent 1px)', backgroundSize: '24px 24px' }} />

      {showOnboarding && <OnboardingModal onComplete={handleOnboardingComplete} />}

      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        currentPersona={userPersona}
        onRetakeOnboarding={() => { setShowSettings(false); setShowOnboarding(true); }}
        customPrompts={customPrompts}
        onSavePrompt={handleSavePrompt}
        onDeletePrompt={handleDeletePrompt}
      />

      <Sidebar
        isOpen={isMenuOpen}
        onToggle={() => setIsMenuOpen(!isMenuOpen)}
        onOpenSettings={() => setShowSettings(true)}
      />

      <div className={`flex-1 flex flex-col min-w-0 transition-[padding] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] relative pl-0 ${isMenuOpen ? 'md:pl-[280px]' : 'md:pl-[72px]'}`}>
        <AppHeader
          showHeader={showHeader}
          onMenuClick={() => setIsMenuOpen(true)}
          currentChatTitle={currentChatTitle || null}
          contentStyle={contentStyle}
        />

        <ErrorBoundary
          onError={(error, errorInfo) => {
            // Log error to external service in production
            console.error('Application Error:', error, errorInfo);

            // In production, send to error reporting service
            if (process.env.NODE_ENV === 'production') {
              // Example: Send to Sentry, LogRocket, etc.
              // Sentry.captureException(error, { contexts: { react: errorInfo } });
            }
          }}
        >
          <Routes>
            <Route path="/login" element={<LoginView />} />
            <Route path="/" element={
              <ChatView hasStarted={hasStarted} contentStyle={contentStyle} allPrompts={allPrompts} />
            } />
            <Route path="/chat/:id" element={
              <ChatView hasStarted={hasStarted} contentStyle={contentStyle} allPrompts={allPrompts} />
            } />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ErrorBoundary>
      </div>
    </div>
  );
};

// Root App Component with Providers
const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <Router>
          <AuthProvider>
            <FolderProvider>
              <ChatProvider>
                <MainLayout />
                <ThemeToaster />
              </ChatProvider>
            </FolderProvider>
          </AuthProvider>
        </Router>
      </ThemeProvider>
    </ErrorBoundary>
  );
};

const ThemeToaster = () => {
  const { theme } = useTheme();
  return <Toaster theme={theme} position="top-center" richColors />;
};

export default App;