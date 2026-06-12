import { useNetworkStore } from '@/store';
import { useUIStore } from '@/store';
import { ScrollArea } from '@/components/ui/scroll-area';
import { NetworkPanel } from './panels/NetworkPanel';
import { TransientPanel } from './TransientPanel';

export function Sidebar() {
  const network = useNetworkStore((s) => s.network);
  const sidebarMode = useUIStore((s) => s.sidebarMode);

  if (!network) return null;

  return (
    <div className="w-[380px] h-full flex flex-col border-r bg-background">
      {sidebarMode === 'transient' ? (
        <TransientPanel />
      ) : (
        <ScrollArea className="flex-1">
          <NetworkPanel />
        </ScrollArea>
      )}
    </div>
  );
}
