import { forwardRef } from 'react';
import { Menu } from 'lucide-react';

type AppHeaderProps = {
  sidebarOpen: boolean;
  onMenuClick: () => void;
};

export const AppHeader = forwardRef<HTMLButtonElement, AppHeaderProps>(function AppHeader(
  { sidebarOpen, onMenuClick },
  ref
) {
  return (
    <header className="fixed top-0 left-0 right-0 z-40 flex items-center h-14 px-4 bg-[linear-gradient(180deg,hsl(var(--background)/0.62)_0%,hsl(var(--background)/0.22)_100%)] backdrop-blur-2xl backdrop-saturate-150 transition-colors duration-200">
      <button
        ref={ref}
        type="button"
        onClick={onMenuClick}
        className="p-2 rounded-lg text-foreground/90 hover:text-foreground transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        aria-label={sidebarOpen ? '메뉴 닫기' : '메뉴 열기'}
        aria-expanded={sidebarOpen}
        title={sidebarOpen ? '메뉴 닫기' : '메뉴 열기'}
      >
        <Menu size={26} strokeWidth={2.5} />
      </button>
      <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 select-none">
        <img src="/brand/weav-ai-wordmark.svg" alt="WEAV AI" className="h-6 w-auto" draggable={false} />
      </div>
    </header>
  );
});
