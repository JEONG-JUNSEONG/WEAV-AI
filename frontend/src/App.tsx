import React, { useState } from 'react';
import { AppProvider, useApp } from '@/contexts/AppContext';
import { ChatProvider } from '@/contexts/ChatContext';
import { AppHeader } from '@/components/layout/AppHeader';
import { Sidebar } from '@/components/layout/Sidebar';
import { ChatView } from '@/components/chat/ChatView';

function AppContent() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  useApp();

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main
        className={`flex-1 flex flex-col min-w-0 transition-[margin] duration-300 ease-out ${
          sidebarOpen ? 'ml-72' : 'ml-0'
        }`}
      >
        <AppHeader onMenuClick={() => setSidebarOpen((v) => !v)} />
        <div className="flex-1 flex overflow-hidden">
          <ChatView />
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <ChatProvider>
        <AppContent />
      </ChatProvider>
    </AppProvider>
  );
}
