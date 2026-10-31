import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { formatDuration, timeAgo } from '../utils/format';
import {
  ThumbsUp,
  Play,
  AlertCircle,
  Eye,
  Calendar,
  Compass,
  RotateCcw,
} from 'lucide-react';

export default function Liked() {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchLikedVideos = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.get('/me/likes');
      setVideos(res.data.items || []);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to load liked videos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLikedVideos();
  }, [fetchLikedVideos]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto py-2">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2.5">
            <ThumbsUp className="w-6 h-6 text-red-500 fill-current" />
            <span>Liked Videos</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            {loading ? 'Loading...' : `${videos.length} liked videos`}
          </p>
        </div>
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
              fetchLikedVideos();
            }}
            className="px-3.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-medium text-xs transition cursor-pointer flex items-center gap-1.5 flex-shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
            <div key={n} className="space-y-3 animate-pulse">
              <div className="aspect-video bg-slate-800 rounded-xl" />
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
        <div className="text-center py-20 px-4 rounded-3xl border border-dashed border-slate-800 bg-slate-900/20">
          <div className="w-16 h-16 rounded-full bg-slate-800/80 flex items-center justify-center mx-auto mb-4 text-slate-400">
            <ThumbsUp className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-bold text-white">No liked videos yet</h2>
          <p className="text-sm text-slate-400 max-w-md mx-auto mt-1 mb-6">
            Videos you like will show up here, newest first, for easy re-watching and reference.
          </p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-red-600 hover:bg-red-500 text-white font-medium text-sm transition shadow-lg shadow-red-600/30"
          >
            <Compass className="w-4 h-4" />
            <span>Discover Videos</span>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {videos.map((vid) => (
            <Link
              key={vid.id}
              to={`/watch/${vid.id}`}
              className="group flex flex-col space-y-3 rounded-2xl overflow-hidden hover:bg-slate-900/40 p-2 transition duration-200"
            >
              {/* Thumbnail Container */}
              <div className="relative aspect-video rounded-xl bg-slate-900 overflow-hidden border border-slate-800/80 group-hover:border-slate-700 transition">
                {vid.thumbnailUrl ? (
                  <img
                  loading="lazy"
                  decoding="async"
                    src={vid.thumbnailUrl}
                    alt={vid.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-slate-850">
                    <Play className="w-8 h-8 text-slate-600 group-hover:text-red-500 transition" />
                  </div>
                )}

                {/* Duration Badge */}
                {vid.durationSec > 0 && (
                  <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/85 text-[11px] font-mono font-medium text-white tracking-wider">
                    {formatDuration(vid.durationSec)}
                  </span>
                )}
              </div>

              {/* Video Info */}
              <div className="flex gap-3 px-1">
                {/* Channel Avatar */}
                <div className="w-9 h-9 rounded-full bg-red-600/20 text-red-400 border border-red-500/30 flex items-center justify-center font-bold text-xs flex-shrink-0 mt-0.5">
                  {vid.channel?.displayName?.[0]?.toUpperCase() || 'C'}
                </div>

                {/* Title & Metadata */}
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-white text-sm line-clamp-2 leading-snug group-hover:text-red-400 transition">
                    {vid.title}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 truncate hover:text-slate-300">
                    {vid.channel?.displayName || 'Creator'}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                    <span className="flex items-center gap-1">
                      <Eye className="w-3 h-3" />
                      {vid.viewCount?.toLocaleString() || 0}
                    </span>
                    <span>&bull;</span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      Liked {timeAgo(vid.likedAt)}
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
