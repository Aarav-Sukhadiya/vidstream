import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import api from '../api/client';
import {
  Search as SearchIcon,
  SlidersHorizontal,
  Loader2,
  Calendar,
  Eye,
  Video as VideoIcon,
  AlertCircle,
} from 'lucide-react';

const TAG_FILTERS = ['All', 'React', 'Node', 'System Design', 'Algorithms', 'Databases', 'DevOps'];

const SORT_OPTIONS = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'newest', label: 'Upload date' },
  { value: 'views', label: 'View count' },
];

export default function Search() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryParam = searchParams.get('q') || '';
  const sortParam = searchParams.get('sort') || 'relevance';
  const tagParam = searchParams.get('tag') || 'All';

  const [videos, setVideos] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');

  const fetchSearchResults = useCallback(
    async (cursor = null) => {
      try {
        const params = {
          limit: 12,
          sort: sortParam,
        };
        if (queryParam.trim()) params.q = queryParam.trim();
        if (tagParam && tagParam !== 'All') params.tag = tagParam;
        if (cursor) params.cursor = cursor;

        const res = await api.get('/videos', { params });
        const items = res.data.items || [];

        setVideos((prev) => (cursor ? [...prev, ...items] : items));
        setNextCursor(res.data.nextCursor || null);
        setError('');
      } catch (err) {
        setError(err.response?.data?.error?.message || 'Failed to fetch search results');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [queryParam, sortParam, tagParam]
  );

  useEffect(() => {
    setLoading(true);
    setVideos([]);
    setNextCursor(null);
    fetchSearchResults();
  }, [fetchSearchResults]);

  const handleSortChange = (newSort) => {
    const next = new URLSearchParams(searchParams);
    next.set('sort', newSort);
    setSearchParams(next);
  };

  const handleTagChange = (newTag) => {
    const next = new URLSearchParams(searchParams);
    if (newTag === 'All') {
      next.delete('tag');
    } else {
      next.set('tag', newTag);
    }
    setSearchParams(next);
  };

  const handleLoadMore = () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    fetchSearchResults(nextCursor);
  };

  const formatDuration = (sec) => {
    if (!sec) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const timeAgo = (dateStr) => {
    if (!dateStr) return '';
    const diff = Math.floor((new Date() - new Date(dateStr)) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto py-2">
      {/* Top Filter and Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-800">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <SearchIcon className="w-5 h-5 text-red-500" />
            {queryParam ? (
              <span>
                Results for <span className="text-red-400">&ldquo;{queryParam}&rdquo;</span>
              </span>
            ) : (
              <span>Browse All Videos</span>
            )}
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            {loading ? 'Searching...' : `${videos.length} videos found`}
          </p>
        </div>

        {/* Sort Select */}
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-slate-400" />
          <span className="text-xs text-slate-400 font-medium">Sort by:</span>
          <select
            value={sortParam}
            onChange={(e) => handleSortChange(e.target.value)}
            className="bg-slate-800 text-slate-200 border border-slate-700 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-red-500 cursor-pointer"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tag Filters */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        {TAG_FILTERS.map((tag) => (
          <button
            key={tag}
            onClick={() => handleTagChange(tag)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
              tagParam === tag || (tag === 'All' && !searchParams.get('tag'))
                ? 'bg-red-600 text-white shadow-md shadow-red-600/20'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
            }`}
          >
            {tag}
          </button>
        ))}
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center gap-3 text-sm text-red-400">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Loading Skeletons */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4].map((n) => (
            <div
              key={n}
              className="flex flex-col sm:flex-row gap-4 p-4 rounded-2xl bg-slate-900/60 border border-slate-800 animate-pulse"
            >
              <div className="w-full sm:w-64 h-36 bg-slate-800 rounded-xl" />
              <div className="flex-1 space-y-3">
                <div className="h-5 bg-slate-800 rounded w-3/4" />
                <div className="h-3 bg-slate-800 rounded w-1/3" />
                <div className="h-3 bg-slate-800 rounded w-1/2" />
                <div className="h-10 bg-slate-800 rounded w-full" />
              </div>
            </div>
          ))}
        </div>
      ) : videos.length === 0 ? (
        /* Empty State */
        <div className="text-center py-20 px-4 rounded-3xl border border-dashed border-slate-800 bg-slate-900/20">
          <div className="w-16 h-16 rounded-full bg-slate-800/80 flex items-center justify-center mx-auto mb-4 text-slate-400">
            <VideoIcon className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-bold text-slate-200">No videos found</h2>
          <p className="text-sm text-slate-400 max-w-md mx-auto mt-1 mb-6">
            We couldn&apos;t find any videos matching your search criteria. Try using different keywords,
            clearing the tag filters, or browsing all content.
          </p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-red-600 hover:bg-red-500 text-white font-medium text-sm transition shadow-lg shadow-red-600/30"
          >
            <span>Explore Home Feed</span>
          </Link>
        </div>
      ) : (
        /* Results List */
        <div className="space-y-4">
          {videos.map((vid) => (
            <Link
              key={vid.id}
              to={`/watch/${vid.id}`}
              className="group flex flex-col sm:flex-row gap-4 p-3 sm:p-4 rounded-2xl bg-slate-900/40 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 transition"
            >
              {/* Thumbnail Container */}
              <div className="relative w-full sm:w-64 sm:min-w-64 aspect-video rounded-xl overflow-hidden bg-slate-800 flex-shrink-0">
                {vid.thumbnailUrl ? (
                  <img
                    src={vid.thumbnailUrl}
                    alt={vid.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-600">
                    <VideoIcon className="w-10 h-10" />
                  </div>
                )}
                <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-black/80 backdrop-blur text-[11px] font-semibold text-white">
                  {formatDuration(vid.durationSec)}
                </div>
              </div>

              {/* Video Info Container */}
              <div className="flex-1 flex flex-col justify-between py-1 min-w-0">
                <div>
                  <h3 className="font-semibold text-base sm:text-lg text-slate-100 group-hover:text-red-400 transition line-clamp-2">
                    {vid.title}
                  </h3>

                  {/* Channel & Stats */}
                  <div className="flex items-center gap-2 text-xs text-slate-400 mt-1.5 flex-wrap">
                    <span className="font-medium text-slate-300 hover:text-white">
                      {vid.channel?.displayName || 'Creator'}
                    </span>
                    <span>&bull;</span>
                    <span className="flex items-center gap-1">
                      <Eye className="w-3.5 h-3.5" />
                      {vid.viewCount?.toLocaleString() || 0} views
                    </span>
                    <span>&bull;</span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {timeAgo(vid.publishedAt)}
                    </span>
                  </div>

                  {/* Description Snippet */}
                  <p className="text-xs text-slate-400 mt-2 line-clamp-2 leading-relaxed">
                    {vid.description || 'No description provided.'}
                  </p>
                </div>

                {/* Tags */}
                {vid.tags && vid.tags.length > 0 && (
                  <div className="flex items-center gap-1.5 mt-3 flex-wrap">
                    {vid.tags.map((t) => (
                      <span
                        key={t}
                        className="px-2 py-0.5 rounded-md bg-slate-800 text-[10px] font-medium text-slate-300 border border-slate-700/60"
                      >
                        #{t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </Link>
          ))}

          {/* Load More Pagination */}
          {nextCursor && (
            <div className="text-center pt-4">
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="px-6 py-2.5 rounded-full bg-slate-800 hover:bg-slate-700 text-sm font-semibold text-white border border-slate-700 transition flex items-center gap-2 mx-auto disabled:opacity-50 cursor-pointer"
              >
                {loadingMore ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Loading more...</span>
                  </>
                ) : (
                  <span>Load More Results</span>
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
