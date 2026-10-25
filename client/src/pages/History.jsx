import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import {
  History as HistoryIcon,
  Trash2,
  Play,
  Loader2,
  AlertCircle,
  Eye,
  Calendar,
  Compass,
} from 'lucide-react';

export default function History() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState('');

  const fetchHistory = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.get('/me/history');
      setItems(res.data.items || []);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to load watch history');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleClearHistory = async () => {
    if (!window.confirm('Are you sure you want to clear your entire watch history?')) {
      return;
    }
    try {
      setClearing(true);
      await api.delete('/me/history');
      setItems([]);
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Failed to clear watch history');
    } finally {
      setClearing(false);
    }
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2.5">
            <HistoryIcon className="w-6 h-6 text-red-500" />
            <span>Watch History</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Pick up where you left off or review past watched videos
          </p>
        </div>

        {items.length > 0 && (
          <button
            onClick={handleClearHistory}
            disabled={clearing}
            className="self-start sm:self-center inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-800 hover:bg-red-500/10 text-xs font-semibold text-slate-300 hover:text-red-400 border border-slate-700 hover:border-red-500/30 transition cursor-pointer disabled:opacity-50"
          >
            {clearing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Trash2 className="w-3.5 h-3.5" />
            )}
            <span>Clear All History</span>
          </button>
        )}
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center gap-3 text-sm text-red-400">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

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
              </div>
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-20 px-4 rounded-3xl border border-dashed border-slate-800 bg-slate-900/20">
          <div className="w-16 h-16 rounded-full bg-slate-800/80 flex items-center justify-center mx-auto mb-4 text-slate-400">
            <HistoryIcon className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-bold text-white">Your watch history is empty</h2>
          <p className="text-sm text-slate-400 max-w-md mx-auto mt-1 mb-6">
            Videos you watch will appear here with your saved playback progress so you can jump right back in.
          </p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-red-600 hover:bg-red-500 text-white font-medium text-sm transition shadow-lg shadow-red-600/30"
          >
            <Compass className="w-4 h-4" />
            <span>Discover Videos to Watch</span>
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((entry) => {
            const vid = entry.video;
            return (
              <Link
                key={entry.id}
                to={`/watch/${vid.id}`}
                className="group flex flex-col sm:flex-row gap-4 p-3 sm:p-4 rounded-2xl bg-slate-900/40 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 transition"
              >
                {/* Thumbnail Container with Progress Bar */}
                <div className="relative w-full sm:w-64 sm:min-w-64 aspect-video rounded-xl overflow-hidden bg-slate-800 flex-shrink-0">
                  {vid.thumbnailUrl ? (
                    <img
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
                  <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/80 backdrop-blur text-[11px] font-semibold text-white">
                    {formatDuration(vid.durationSec)}
                  </div>

                  {/* Red Watch Progress Bar Overlay */}
                  <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-slate-700/80">
                    <div
                      className="h-full bg-red-600 rounded-r"
                      style={{ width: `${entry.progressPercent}%` }}
                    />
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
                        Watched {timeAgo(entry.updatedAt)}
                      </span>
                    </div>

                    {/* Description Snippet */}
                    <p className="text-xs text-slate-400 mt-2 line-clamp-2 leading-relaxed">
                      {vid.description || 'No description provided.'}
                    </p>
                  </div>

                  {/* Resume Timestamp Badge */}
                  <div className="mt-3 flex items-center gap-2 text-xs text-slate-400">
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-[11px] font-medium text-red-400 border border-slate-700">
                      Resume at {formatDuration(entry.positionSec)}
                    </span>
                    <span className="text-[11px]">({entry.progressPercent}% completed)</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
