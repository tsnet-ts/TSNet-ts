import { useUIStore } from '@/store';
import { useNetworkStore } from '@/store';
import { FileUpload } from '@/components/FileUpload';
import { NetworkMap } from '@/components/NetworkMap';
import { Sidebar } from '@/components/Sidebar';
import { Toolbar } from '@/components/Toolbar';

function App() {
  const showUpload = useUIStore((s) => s.showUpload);
  const network = useNetworkStore((s) => s.network);
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const setSidebarOpen = useUIStore((s) => s.setSidebarOpen);

  return (
    <div className="flex flex-col h-full w-full">
      {!(showUpload || !network) && <Toolbar />}
      <div className="flex flex-1 overflow-hidden">
        {showUpload || !network ? (
          <FileUpload />
        ) : (
          <>
            {sidebarOpen && <Sidebar />}
            <div className="flex-1 relative">
              {/* Toggle sidebar button — vertically centered tab on left edge */}
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="absolute top-1/2 -translate-y-1/2 left-0 z-[1000] bg-white border border-l-0 border-gray-200 rounded-r-md shadow-md w-5 h-10 flex items-center justify-center hover:bg-gray-50 transition-colors"
                title={sidebarOpen ? 'Close panel' : 'Open panel'}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 text-gray-500">
                  {sidebarOpen ? (
                    <path fillRule="evenodd" d="M11.78 5.22a.75.75 0 0 1 0 1.06L8.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0Z" clipRule="evenodd" />
                  ) : (
                    <path fillRule="evenodd" d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                  )}
                </svg>
              </button>
              <NetworkMap />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default App;
