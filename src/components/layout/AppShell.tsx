import { Columns3, Download, Grid2X2, List, PanelLeftOpen, Rows3, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { usePostStore } from '../../stores/post-store';
import { useSettingsStore } from '../../stores/settings-store';
import { useUiStore } from '../../stores/ui-store';
import { PostDetail } from '../posts/PostDetail';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { ImageViewer } from '../viewer/ImageViewer';
import { downloadPosts } from '../../services/download-service';

export function AppShell({ children }: { children: ReactNode }) {
  const sidebarOpen = useUiStore((state) => state.sidebarOpen);
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);
  const count = usePostStore((state) => state.posts.length);
  const columns = useSettingsStore((state) => state.columns);
  const setColumns = useSettingsStore((state) => state.setColumns);
  const layout = useSettingsStore((state) => state.layout);
  const setLayout = useSettingsStore((state) => state.setLayout);
  const downloadRule = useSettingsStore((state) => state.downloadRule);
  const posts = usePostStore((state) => state.posts);
  const selectedKeys = usePostStore((state) => state.selectedPostKeys);
  const clearSelection = usePostStore((state) => state.clearSelection);
  const selectedPosts = posts.filter((post) => selectedKeys.includes(`${post.source}:${post.id}`));
  const batchDownload = () => { if (selectedPosts.length && window.confirm(`Download ${selectedPosts.length} selected posts?`)) void downloadPosts(selectedPosts, 'full', downloadRule); };
  return (
    <div className="app-shell">
      <Header />
      <div className="workspace">
        <Sidebar />
        <main className="content-area">
          <div className="content-toolbar">
            <div>
              {!sidebarOpen && <button className="icon-button" title="Open sidebar" onClick={toggleSidebar}><PanelLeftOpen size={16} /></button>}
              <span className="result-count"><strong>{count}</strong> loaded</span>
              {selectedPosts.length > 0 && <span className="batch-actions"><strong>{selectedPosts.length}</strong> selected<button title="Download selection" onClick={batchDownload}><Download size={14} /></button><button title="Clear selection" onClick={clearSelection}><X size={14} /></button></span>}
            </div>
            <div><span className="layout-toggle" aria-label="Layout"><button className={layout === 'grid' ? 'is-active' : ''} title="Grid layout" onClick={() => setLayout('grid')}><Grid2X2 size={14} /></button><button className={layout === 'masonry' ? 'is-active' : ''} title="Masonry layout" onClick={() => setLayout('masonry')}><Rows3 size={14} /></button><button className={layout === 'list' ? 'is-active' : ''} title="List layout" onClick={() => setLayout('list')}><List size={14} /></button></span><label className="columns-control"><Columns3 size={15} /><span>Columns</span><input type="range" min="2" max="8" value={columns} onChange={(event) => setColumns(Number(event.target.value))} /><output>{columns}</output></label></div>
          </div>
          {children}
        </main>
      </div>
      <PostDetail />
      <ImageViewer />
    </div>
  );
}
