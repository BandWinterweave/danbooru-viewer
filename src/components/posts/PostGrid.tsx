import { useWindowVirtualizer } from '@tanstack/react-virtual';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, LoaderCircle, SearchX } from 'lucide-react';
import { useInfiniteScroll } from '../../hooks/useInfiniteScroll';
import { usePostStore } from '../../stores/post-store';
import { useSettingsStore } from '../../stores/settings-store';
import { PostCard } from './PostCard';

export function PostGrid() {
  const posts = usePostStore((state) => state.posts);
  const isLoading = usePostStore((state) => state.isLoading);
  const isLoadingMore = usePostStore((state) => state.isLoadingMore);
  const hasMore = usePostStore((state) => state.hasMore);
  const error = usePostStore((state) => state.error);
  const loadMore = usePostStore((state) => state.loadMore);
  const columns = useSettingsStore((state) => state.columns);
  const layout = useSettingsStore((state) => state.layout);
  const source = useSettingsStore((state) => state.activeSource);
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
  const gridRef = useRef<HTMLDivElement>(null);
  const load = useCallback(() => void loadMore(), [loadMore]);
  const sentinel = useInfiniteScroll(load, hasMore && posts.length > 0 && !isLoading && !isLoadingMore);
  useEffect(() => { const resize = () => setViewportWidth(window.innerWidth); window.addEventListener('resize', resize); return () => window.removeEventListener('resize', resize); }, []);
  const responsiveColumns = layout === 'list' ? 1 : viewportWidth <= 720 ? 2 : viewportWidth <= 1000 ? Math.min(columns, 4) : columns;
  const masonry = layout === 'masonry';
  const rowCount = Math.ceil(posts.length / responsiveColumns);
  const availableWidth = gridRef.current?.clientWidth ?? Math.max(viewportWidth - 250, 320);
  const cardWidth = (availableWidth - (responsiveColumns - 1) * 9) / responsiveColumns;
  const cardHeight = layout === 'list' ? 178 : cardWidth * 1.18;
  const virtualizer = useWindowVirtualizer({
    count: masonry ? posts.length : rowCount,
    lanes: masonry ? responsiveColumns : 1,
    estimateSize: (index) => masonry ? cardWidth * Math.min(Math.max((posts[index]?.imageHeight || 1) / (posts[index]?.imageWidth || 1), .65), 1.8) + 9 : cardHeight + 9,
    overscan: 3,
    scrollMargin: gridRef.current ? gridRef.current.getBoundingClientRect().top + window.scrollY : 0,
  });

  if (isLoading) return <div className="state-panel"><LoaderCircle className="spin" size={25} /><strong>Reading the index</strong><span>Fetching the latest {source} posts...</span></div>;
  if (error && !posts.length) return <div className="state-panel state-panel--error"><AlertCircle size={25} /><strong>{source} could not be reached</strong><span>{error}</span></div>;
  if (!posts.length) return <div className="state-panel"><SearchX size={25} /><strong>No posts match this search</strong><span>Remove a filter or try a broader tag.</span></div>;

  return (
    <>
      <div ref={gridRef} className={`virtual-grid layout-${layout}`} style={{ height: `${virtualizer.getTotalSize()}px`, '--grid-columns': responsiveColumns } as React.CSSProperties}>
        {masonry ? virtualizer.getVirtualItems().map((item) => {
          const post = posts[item.index];
          const aspect = post.imageWidth && post.imageHeight ? post.imageWidth / post.imageHeight : 1 / 1.18;
          return <div className="masonry-item" key={item.key} ref={virtualizer.measureElement} data-index={item.index} style={{ left: `calc(${(item.lane ?? 0) * 100 / responsiveColumns}% + ${(item.lane ?? 0) * 4.5}px)`, width: `calc(${100 / responsiveColumns}% - ${9 * (responsiveColumns - 1) / responsiveColumns}px)`, transform: `translateY(${item.start - virtualizer.options.scrollMargin}px)`, '--media-aspect': aspect } as React.CSSProperties}><PostCard post={post} /></div>;
        }) : virtualizer.getVirtualItems().map((row) => {
          const rowPosts = posts.slice(row.index * responsiveColumns, (row.index + 1) * responsiveColumns);
          return <div className="post-grid virtual-row" key={row.key} ref={virtualizer.measureElement} data-index={row.index} style={{ transform: `translateY(${row.start - virtualizer.options.scrollMargin}px)` }}>{rowPosts.map((post) => <PostCard key={`${post.source}:${post.id}`} post={post} />)}</div>;
        })}
      </div>
      <div ref={sentinel} className="load-sentinel">
        {isLoadingMore && <><LoaderCircle className="spin" size={18} /> Loading more</>}
        {!hasMore && <span>End of results</span>}
        {error && posts.length > 0 && <span className="inline-error">{error}</span>}
      </div>
    </>
  );
}
