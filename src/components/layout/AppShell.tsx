import { Columns3, Download, Grid2X2, List, LoaderCircle, PanelLeftOpen, Rows3, X } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import { usePostStore } from '../../stores/post-store';
import { useSettingsStore } from '../../stores/settings-store';
import { useUiStore } from '../../stores/ui-store';
import { PostDetail } from '../posts/PostDetail';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { downloadPosts } from '../../services/download-service';
import { notify } from '../../services/notifications';
import { useI18n } from '../../i18n/runtime';
import { hasAvailablePreview } from '../../services/post-media';

export function AppShell({ children }: { children: ReactNode }) {
  const { messages: { shell: shellMessages } } = useI18n();
  const sidebarOpen = useUiStore((state) => state.sidebarOpen);
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);
  const isLoading = usePostStore((state) => state.isLoading);
  const columns = useSettingsStore((state) => state.columns);
  const setColumns = useSettingsStore((state) => state.setColumns);
  const layout = useSettingsStore((state) => state.layout);
  const setLayout = useSettingsStore((state) => state.setLayout);
  const downloadRule = useSettingsStore((state) => state.downloadRule);
  const posts = usePostStore((state) => state.posts);
  const hideUnavailablePreviews = useSettingsStore((state) => state.hideUnavailablePreviews);
  const detailOpen = useUiStore((state) => state.detailOpen);
  const view = useUiStore((state) => state.view);
  const backgroundRef = useRef<HTMLDivElement>(null);
  const count = hideUnavailablePreviews ? posts.filter(hasAvailablePreview).length : posts.length;
  const selectedKeys = usePostStore((state) => state.selectedPostKeys);
  const clearSelection = usePostStore((state) => state.clearSelection);
  const selectedPosts = posts.filter((post) => selectedKeys.includes(`${post.source}:${post.id}`));
  useEffect(() => {
    if (!backgroundRef.current) return;
    backgroundRef.current.inert = detailOpen;
  }, [detailOpen]);
  const batchDownload = async () => {
    if (!selectedPosts.length || !window.confirm(shellMessages.appShell.confirmDownloadSelection(selectedPosts.length))) return;
    try {
      await downloadPosts(selectedPosts, 'full', downloadRule);
      notify({ tone: 'success', title: shellMessages.appShell.downloadStarted, description: shellMessages.appShell.postsQueued(selectedPosts.length) });
    } catch (error) {
      notify({ tone: 'error', title: shellMessages.appShell.downloadFailed, description: error instanceof Error ? error.message : undefined });
    }
  };
  return (
    <div className={`app-shell app-shell--${view}`}>
      <div ref={backgroundRef} className="app-background">
      <Header />
      <div className="workspace">
        <Sidebar />
        <main className="content-area">
          {view !== 'browse' && !sidebarOpen && <button className="icon-button view-sidebar-open" aria-label={shellMessages.appShell.openSidebar} title={shellMessages.appShell.openSidebar} onClick={toggleSidebar}><PanelLeftOpen size={16} /></button>}
          {view === 'browse' && <div className="content-toolbar">
            <div>
               {!sidebarOpen && <button className="icon-button" aria-label={shellMessages.appShell.openSidebar} title={shellMessages.appShell.openSidebar} onClick={toggleSidebar}><PanelLeftOpen size={16} /></button>}
               <span className="result-count"><strong>{count}</strong> {shellMessages.appShell.loaded}</span>
               {isLoading && posts.length > 0 && <span className="refresh-status" role="status"><LoaderCircle className="spin" size={13} />{shellMessages.appShell.refreshing}</span>}
               {selectedPosts.length > 0 && <span className="batch-actions"><strong>{selectedPosts.length}</strong> {shellMessages.appShell.selected}<button title={shellMessages.appShell.downloadSelection} onClick={() => void batchDownload()}><Download size={14} /></button><button title={shellMessages.appShell.clearSelection} onClick={clearSelection}><X size={14} /></button></span>}
            </div>
             <div><span className="layout-toggle" aria-label={shellMessages.appShell.layout}><button className={layout === 'grid' ? 'is-active' : ''} title={shellMessages.appShell.gridLayout} onClick={() => setLayout('grid')}><Grid2X2 size={14} /></button><button className={layout === 'masonry' ? 'is-active' : ''} title={shellMessages.appShell.masonryLayout} onClick={() => setLayout('masonry')}><Rows3 size={14} /></button><button className={layout === 'list' ? 'is-active' : ''} title={shellMessages.appShell.listLayout} onClick={() => setLayout('list')}><List size={14} /></button></span><label className="columns-control"><Columns3 size={15} /><span>{shellMessages.appShell.columns}</span><input type="range" min="2" max="8" value={columns} onChange={(event) => setColumns(Number(event.target.value))} /><output>{columns}</output></label></div>
          </div>}
          {children}
        </main>
      </div>
      </div>
      <PostDetail />
    </div>
  );
}
