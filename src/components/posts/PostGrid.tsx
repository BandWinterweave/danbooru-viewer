import { useWindowVirtualizer } from '@tanstack/react-virtual';
import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, LoaderCircle, SearchX } from 'lucide-react';
import { useInfiniteScroll } from '../../hooks/useInfiniteScroll';
import { usePostStore } from '../../stores/post-store';
import { useSettingsStore } from '../../stores/settings-store';
import { PostCard } from './PostCard';
import { StatePanel } from '../feedback/StatePanel';
import { messages } from '../../i18n/en';
import { hasAvailablePreview } from '../../services/post-media';

export function PostGrid() {
  const posts = usePostStore((state) => state.posts);
  const isLoading = usePostStore((state) => state.isLoading);
  const isLoadingMore = usePostStore((state) => state.isLoadingMore);
  const hasMore = usePostStore((state) => state.hasMore);
  const error = usePostStore((state) => state.error);
  const loadMore = usePostStore((state) => state.loadMore);
  const retry = usePostStore((state) => state.retry);
  const columns = useSettingsStore((state) => state.columns);
  const layout = useSettingsStore((state) => state.layout);
  const source = useSettingsStore((state) => state.activeSource);
  const hideUnavailablePreviews = useSettingsStore((state) => state.hideUnavailablePreviews);
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
  const [gridElement, setGridElement] = useState<HTMLDivElement | null>(null);
  const [gridMetrics, setGridMetrics] = useState({ width: Math.max(window.innerWidth - 250, 320), top: 0 });
  const load = useCallback(() => void loadMore(), [loadMore]);
  const sentinel = useInfiniteScroll(load, hasMore && posts.length > 0 && !isLoading && !isLoadingMore);
  useEffect(() => { const resize = () => setViewportWidth(window.innerWidth); window.addEventListener('resize', resize); return () => window.removeEventListener('resize', resize); }, []);
  useEffect(() => {
    if (!gridElement) return;
    const updateMetrics = () => {
      const rect = gridElement.getBoundingClientRect();
      const next = { width: rect.width, top: rect.top + window.scrollY };
      setGridMetrics((current) => current.width === next.width && current.top === next.top ? current : next);
    };
    updateMetrics();
    const observer = new ResizeObserver(updateMetrics);
    observer.observe(gridElement);
    return () => observer.disconnect();
  }, [gridElement]);
  const responsiveColumns = layout === 'list' ? 1 : viewportWidth <= 720 ? 2 : viewportWidth <= 1000 ? Math.min(columns, 4) : columns;
  const masonry = layout === 'masonry';
  const visiblePosts = hideUnavailablePreviews ? posts.filter(hasAvailablePreview) : posts;
  const rowCount = Math.ceil(visiblePosts.length / responsiveColumns);
  const availableWidth = gridMetrics.width;
  const cardWidth = (availableWidth - (responsiveColumns - 1) * 10) / responsiveColumns;
  const cardHeight = layout === 'list' ? 178 : cardWidth * 1.18;
  const virtualizer = useWindowVirtualizer({
    count: masonry ? visiblePosts.length : rowCount,
    lanes: masonry ? responsiveColumns : 1,
    estimateSize: (index) => masonry ? cardWidth * Math.min(Math.max((visiblePosts[index]?.imageHeight || 1) / (visiblePosts[index]?.imageWidth || 1), .65), 1.8) + 10 : cardHeight + 10,
    overscan: 3,
    scrollMargin: gridMetrics.top,
  });

  if (isLoading) return <StatePanel icon={LoaderCircle} busy title={messages.states.loadingTitle} body={messages.states.loadingBody(source)} />;
  if (error && !posts.length) return <StatePanel icon={AlertCircle} tone="error" title={messages.states.errorTitle(source)} body={error} onRetry={() => void retry()} />;
  if (!posts.length) return <StatePanel icon={SearchX} title={messages.states.emptyTitle} body={messages.states.emptyBody} />;

  return (
    <>
      <div ref={setGridElement} className={`virtual-grid layout-${layout}`} style={{ height: `${virtualizer.getTotalSize()}px`, '--grid-columns': responsiveColumns } as React.CSSProperties}>
        {masonry ? virtualizer.getVirtualItems().map((item) => {
           const post = visiblePosts[item.index];
          const aspect = post.imageWidth && post.imageHeight ? post.imageWidth / post.imageHeight : 1 / 1.18;
          return <div className="masonry-item" key={item.key} ref={virtualizer.measureElement} data-index={item.index} style={{ left: `calc(${(item.lane ?? 0) * 100 / responsiveColumns}% + ${(item.lane ?? 0) * 5}px)`, width: `calc(${100 / responsiveColumns}% - ${10 * (responsiveColumns - 1) / responsiveColumns}px)`, transform: `translateY(${item.start - virtualizer.options.scrollMargin}px)`, '--media-aspect': aspect } as React.CSSProperties}><PostCard post={post} /></div>;
        }) : virtualizer.getVirtualItems().map((row) => {
           const rowPosts = visiblePosts.slice(row.index * responsiveColumns, (row.index + 1) * responsiveColumns);
          return <div className="post-grid virtual-row" key={row.key} ref={virtualizer.measureElement} data-index={row.index} style={{ transform: `translateY(${row.start - virtualizer.options.scrollMargin}px)` }}>{rowPosts.map((post) => <PostCard key={`${post.source}:${post.id}`} post={post} />)}</div>;
        })}
      </div>
      <div ref={sentinel} className="load-sentinel">
         {isLoadingMore && <><LoaderCircle className="spin" size={18} /> {messages.states.loadingMore}</>}
         {!hasMore && <span>{messages.states.end}</span>}
         {error && posts.length > 0 && <><span className="inline-error">{error}</span><button className="inline-retry" onClick={() => void retry()}>{messages.actions.retry}</button></>}
      </div>
    </>
  );
}
