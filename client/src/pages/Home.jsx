import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { formatDuration, timeAgo } from '../utils/format';
import {
  Video as VideoIcon,
  Play,
  Loader2,
  AlertCircle,
  Eye,
  Calendar,
  Sparkles,
  RotateCcw,
} from 'lucide-react';

const TAG_FILTERS = ['All', 'React', 'Node', 'System Design', 'Algorithms', 'AI', 'Security', 'Design', 'GameDev', 'Mobile', 'Databases', 'DevOps', 'Frontend'];

export default function Home() {
  const [videos, setVideos] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [selectedTag, setSelectedTag] = useState('All');

  const requestIdRef = useRef(0);

  const fetchVideos = useCallback(async (tag = 'All', cursor = null) => {
    // Ignore responses from superseded requests (e.g. rapid tag switching)
    const requestId = ++requestIdRef.current;
    const isStale = () => requestId !== requestIdRef.current;
    try {
      const params = { limit: 12 };
      if (tag !== 'All') params.tag = tag;
      if (cursor) params.cursor = cursor;

      const res = await api.get('/videos', { params });
      if (isStale()) return;
      const newItems = res.data.items || [];

      setVideos((prev) => (cursor ? [...prev, ...newItems] : newItems));
      setNextCursor(res.data.nextCursor || null);
      setError('');
    } catch (err) {
      if (isStale()) return;
      setError(err.response?.data?.error?.message || 'Failed to load video feed');
    } finally {
      if (!isStale()) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchVideos(selectedTag);
  }, [selectedTag, fetchVideos]);

  const handleTagClick = (tag) => {
    if (tag === selectedTag) return;
    setSelectedTag(tag);
    setVideos([]);
    setNextCursor(null);
  };

  const handleLoadMore = () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    fetchVideos(selectedTag, nextCursor);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto py-2">
      {/* Category Tag Filter Chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        {TAG_FILTERS.map((tag) => (
          <button
            key={tag}
            onClick={() => handleTagClick(tag)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
              selectedTag === tag
                ? 'bg-white text-slate-900 shadow-md'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
            }`}
          >
            {tag}
          </button>
        ))}
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-between gap-3 text-sm text-red-400">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => {
              setLoading(true);
              fetchVideos(selectedTag);
            }}
            className="px-3.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-medium text-xs transition cursor-pointer flex items-center gap-1.5 flex-shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* Video Feed Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="animate-pulse space-y-3">
              <div className="aspect-video bg-slate-800 rounded-2xl" />
              <div className="flex gap-3">
                <div className="w-9 h-9 rounded-full bg-slate-800 flex-shrink-0" />
                <div className="space-y-2 flex-1">
                  <div className="h-3.5 bg-slate-800 rounded w-5/6" />
                  <div className="h-3 bg-slate-800 rounded w-1/2" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : videos.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-slate-800 rounded-3xl bg-slate-900/30">
          <VideoIcon className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-white">No videos found</h3>
          <p className="text-sm text-slate-400 max-w-sm mx-auto mt-1 mb-6">
            {selectedTag !== 'All'
              ? `No public videos found under tag #${selectedTag}. Try selecting All tags.`
              : 'Be the first creator to upload a video to VidStream!'}
          </p>
          <Link
            to="/upload"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white font-medium text-sm rounded-xl transition"
          >
            <Sparkles className="w-4 h-4" />
            <span>Upload First Video</span>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {videos.map((video) => (
            <Link
              key={video.id}
              to={`/watch/${video.id}`}
              className="group flex flex-col space-y-3 rounded-2xl overflow-hidden hover:bg-slate-900/40 p-2 transition duration-200"
            >
              {/* Thumbnail Container */}
              <div className="relative aspect-video rounded-xl bg-slate-900 overflow-hidden border border-slate-800/80 group-hover:border-slate-700 transition">
                {video.thumbnailUrl ? (
                  <img
                  loading="lazy"
                  decoding="async"
                    src={video.thumbnailUrl}
                    alt={video.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-slate-850">
                    <Play className="w-8 h-8 text-slate-600 group-hover:text-red-500 transition" />
                  </div>
                )}

                {/* Duration Badge */}
                {video.durationSec > 0 && (
                  <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/85 text-[11px] font-mono font-medium text-white tracking-wider">
                    {formatDuration(video.durationSec)}
                  </span>
                )}
              </div>

              {/* Video Info */}
              <div className="flex gap-3 px-1">
                {/* Channel Avatar */}
                <div className="w-9 h-9 rounded-full bg-red-600/20 text-red-400 border border-red-500/30 flex items-center justify-center font-bold text-xs flex-shrink-0 mt-0.5">
                  {video.channel?.displayName?.[0]?.toUpperCase() || 'C'}
                </div>

                {/* Title & Metadata */}
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-white text-sm line-clamp-2 leading-snug group-hover:text-red-400 transition">
                    {video.title}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 truncate hover:text-slate-300">
                    {video.channel?.displayName || 'Creator'}
                  </p>
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                    <span className="flex items-center gap-1">
                      <Eye className="w-3 h-3" />
                      <span>{video.viewCount || 0} views</span>
                    </span>
                    <span>&bull;</span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      <span>{timeAgo(video.publishedAt)}</span>
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Pagination: Load More Button */}
      {nextCursor && (
        <div className="text-center pt-6 pb-8">
          <button
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-sm rounded-xl border border-slate-700 transition cursor-pointer"
          >
            {loadingMore ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-red-500" />
                <span>Loading more videos...</span>
              </>
            ) : (
              <span>Load More Videos</span>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
