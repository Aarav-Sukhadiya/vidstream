import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import {
  Video as VideoIcon,
  Play,
  RotateCcw,
  Trash2,
  Edit2,
  AlertCircle,
  Clock,
  Eye,
  ThumbsUp,
  Upload,
  Loader2,
  CheckCircle2,
  X,
  Check,
} from 'lucide-react';
import { io } from 'socket.io-client';

export default function Studio() {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState({});

  // Editing state
  const [editingVideo, setEditingVideo] = useState(null);
  const [editForm, setEditForm] = useState({ title: '', description: '', visibility: 'public' });

  // Delete confirm modal state
  const [deletingId, setDeletingId] = useState(null);

  const fetchVideos = useCallback(async () => {
    try {
      const res = await api.get('/me/videos');
      setVideos(res.data.items || []);
      setError('');
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to load videos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVideos();
  }, [fetchVideos]);

  // Check if any video is active in queue/transcoding
  const hasActiveJobs = useMemo(
    () => videos.some((v) => v.status === 'queued' || v.status === 'processing'),
    [videos]
  );

  // Poll every 3 seconds if jobs are active
  useEffect(() => {
    if (!hasActiveJobs) return;
    const interval = setInterval(() => {
      fetchVideos();
    }, 3000);
    return () => clearInterval(interval);
  }, [hasActiveJobs, fetchVideos]);

  // Real-time Socket.IO status updates
  useEffect(() => {
    const socket = io('/', { path: '/socket.io', transports: ['websocket', 'polling'] });

    socket.on('video:status', (data) => {
      setVideos((prev) =>
        prev.map((v) =>
          v.id === data.videoId
            ? {
                ...v,
                status: data.status,
                failureReason: data.failureReason || v.failureReason,
                thumbnailUrl: data.thumbnailUrl || v.thumbnailUrl,
                hlsUrl: data.hlsUrl || v.hlsUrl,
                durationSec: data.durationSec || v.durationSec,
              }
            : v
        )
      );
    });

    socket.on('video:deleted', (data) => {
      setVideos((prev) => prev.filter((v) => v.id !== data.videoId));
    });

    return () => socket.disconnect();
  }, []);

  const handleRetry = async (id) => {
    setActionLoading((prev) => ({ ...prev, [id]: 'retry' }));
    try {
      await api.post(`/videos/${id}/retry`);
      setVideos((prev) =>
        prev.map((v) => (v.id === id ? { ...v, status: 'queued', failureReason: null } : v))
      );
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Failed to retry transcode');
    } finally {
      setActionLoading((prev) => ({ ...prev, [id]: false }));
    }
  };

  const handleDelete = async (id) => {
    setActionLoading((prev) => ({ ...prev, [id]: 'delete' }));
    try {
      await api.delete(`/videos/${id}`);
      setVideos((prev) => prev.filter((v) => v.id !== id));
      setDeletingId(null);
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Failed to delete video');
    } finally {
      setActionLoading((prev) => ({ ...prev, [id]: false }));
    }
  };

  const openEditModal = (video) => {
    setEditingVideo(video);
    setEditForm({
      title: video.title,
      description: video.description || '',
      visibility: video.visibility || 'public',
    });
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingVideo) return;
    setActionLoading((prev) => ({ ...prev, [editingVideo.id]: 'save' }));
    try {
      const res = await api.patch(`/videos/${editingVideo.id}`, editForm);
      setVideos((prev) =>
        prev.map((v) => (v.id === editingVideo.id ? { ...v, ...res.data.video } : v))
      );
      setEditingVideo(null);
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Failed to update video');
    } finally {
      setActionLoading((prev) => ({ ...prev, [editingVideo.id]: false }));
    }
  };

  const formatDuration = (sec) => {
    if (!sec) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="max-w-6xl mx-auto py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 pb-6 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <VideoIcon className="w-7 h-7 text-red-500" />
            <span>Channel Content &bull; Studio</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage your uploaded videos, monitor transcoding status, and edit metadata.
          </p>
        </div>

        <Link
          to="/upload"
          className="flex items-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white font-medium text-sm rounded-xl transition shadow-lg shadow-red-950/40"
        >
          <Upload className="w-4 h-4" />
          <span>Upload Video</span>
        </Link>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-between gap-3 text-sm text-red-400">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => {
              setLoading(true);
              fetchVideos();
            }}
            className="px-3.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-medium text-xs transition cursor-pointer flex items-center gap-1.5 flex-shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* Videos List / Table */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin text-red-500 mb-3" />
          <p className="text-sm">Loading your studio content...</p>
        </div>
      ) : videos.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-slate-800 rounded-3xl bg-slate-900/30">
          <VideoIcon className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-white">No videos uploaded yet</h3>
          <p className="text-sm text-slate-400 max-w-sm mx-auto mt-1 mb-6">
            Upload your first video to start sharing your content with the VidStream community.
          </p>
          <Link
            to="/upload"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white font-medium text-sm rounded-xl transition"
          >
            <Upload className="w-4 h-4" />
            <span>Upload Video</span>
          </Link>
        </div>
      ) : (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950/60 text-xs font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="px-6 py-4">Video</th>
                  <th className="px-4 py-4">Visibility</th>
                  <th className="px-4 py-4">Status</th>
                  <th className="px-4 py-4">Stats</th>
                  <th className="px-4 py-4">Date</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {videos.map((video) => (
                  <tr key={video.id} className="hover:bg-slate-850/50 transition">
                    {/* Video Info */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <div className="w-28 h-16 rounded-xl bg-slate-800 overflow-hidden flex-shrink-0 relative border border-slate-700/60 flex items-center justify-center">
                          {video.thumbnailUrl ? (
                            <img
                              src={video.thumbnailUrl}
                              alt={video.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <VideoIcon className="w-6 h-6 text-slate-600" />
                          )}
                          {video.durationSec > 0 && (
                            <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/80 text-[10px] font-mono text-white">
                              {formatDuration(video.durationSec)}
                            </span>
                          )}
                        </div>

                        <div className="min-w-0 max-w-sm">
                          <p className="font-semibold text-white truncate text-sm">
                            {video.title}
                          </p>
                          <p className="text-xs text-slate-400 truncate mt-0.5">
                            {video.description || 'No description provided'}
                          </p>
                          {video.status === 'failed' && video.failureReason && (
                            <p className="text-[11px] text-red-400 mt-1 line-clamp-1 flex items-center gap-1">
                              <AlertCircle className="w-3 h-3 flex-shrink-0" />
                              <span>{video.failureReason}</span>
                            </p>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Visibility */}
                    <td className="px-4 py-4">
                      <span className="px-2 py-1 rounded-md text-xs font-medium uppercase tracking-wide bg-slate-800 text-slate-300 border border-slate-700">
                        {video.visibility}
                      </span>
                    </td>

                    {/* Status Badge */}
                    <td className="px-4 py-4">
                      {video.status === 'ready' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Ready</span>
                        </span>
                      )}
                      {video.status === 'processing' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Processing</span>
                        </span>
                      )}
                      {video.status === 'queued' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/30">
                          <Clock className="w-3.5 h-3.5" />
                          <span>Queued</span>
                        </span>
                      )}
                      {video.status === 'failed' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/30">
                          <AlertCircle className="w-3.5 h-3.5" />
                          <span>Failed</span>
                        </span>
                      )}
                      {video.status === 'awaiting_upload' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-700 text-slate-300">
                          <span>Awaiting</span>
                        </span>
                      )}
                    </td>

                    {/* Stats */}
                    <td className="px-4 py-4 text-xs text-slate-400 space-y-1">
                      <div className="flex items-center gap-1.5">
                        <Eye className="w-3.5 h-3.5" />
                        <span>{video.viewCount || 0} views</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <ThumbsUp className="w-3.5 h-3.5" />
                        <span>{video.likeCount || 0} likes</span>
                      </div>
                    </td>

                    {/* Date */}
                    <td className="px-4 py-4 text-xs text-slate-400">
                      {new Date(video.createdAt).toLocaleDateString()}
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {video.status === 'ready' && (
                          <Link
                            to={`/watch/${video.id}`}
                            title="Watch video"
                            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
                          >
                            <Play className="w-4 h-4" />
                          </Link>
                        )}

                        {video.status === 'failed' && (
                          <button
                            type="button"
                            onClick={() => handleRetry(video.id)}
                            disabled={actionLoading[video.id] === 'retry'}
                            title="Retry transcode"
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/40 text-xs font-semibold transition"
                          >
                            {actionLoading[video.id] === 'retry' ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <RotateCcw className="w-3.5 h-3.5" />
                            )}
                            <span>Retry</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => openEditModal(video)}
                          title="Edit details"
                          className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => setDeletingId(video.id)}
                          title="Delete video"
                          className="p-2 rounded-lg hover:bg-red-500/10 text-slate-400 hover:text-red-400 transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit Metadata Modal */}
      {editingVideo && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
              <h3 className="font-bold text-white text-base">Edit Video Details</h3>
              <button
                type="button"
                onClick={() => setEditingVideo(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                  Title
                </label>
                <input
                  type="text"
                  required
                  maxLength={100}
                  value={editForm.title}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, title: e.target.value }))}
                  className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-red-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                  Description
                </label>
                <textarea
                  rows={4}
                  maxLength={5000}
                  value={editForm.description}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, description: e.target.value }))
                  }
                  className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-red-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                  Visibility
                </label>
                <select
                  value={editForm.visibility}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, visibility: e.target.value }))
                  }
                  className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-red-500"
                >
                  <option value="public">Public</option>
                  <option value="unlisted">Unlisted</option>
                  <option value="private">Private</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingVideo(null)}
                  className="px-4 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading[editingVideo.id] === 'save'}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold bg-red-600 hover:bg-red-500 text-white"
                >
                  {actionLoading[editingVideo.id] === 'save' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingId && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="font-bold text-white text-base flex items-center gap-2 text-red-400">
              <AlertCircle className="w-5 h-5 text-red-500" />
              <span>Permanently Delete Video?</span>
            </h3>
            <p className="text-sm text-slate-300 mt-2">
              Are you sure you want to delete this video? All transcoded HLS renditions, thumbnails,
              and metrics will be permanently removed. This action cannot be undone.
            </p>

            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={() => setDeletingId(null)}
                className="px-4 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDelete(deletingId)}
                disabled={actionLoading[deletingId] === 'delete'}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold bg-red-600 hover:bg-red-500 text-white"
              >
                {actionLoading[deletingId] === 'delete' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                <span>Delete Video</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
