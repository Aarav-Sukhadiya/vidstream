import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../hooks/useAuth';
import {
  Users,
  Video as VideoIcon,
  Play,
  Check,
  AlertCircle,
  Loader2,
  Calendar,
  Eye,
} from 'lucide-react';

export default function Channel() {
  const { handle } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [channel, setChannel] = useState(null);
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscriberCount, setSubscriberCount] = useState(0);
  const [subscribing, setSubscribing] = useState(false);

  const fetchChannelData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.get(`/channels/${handle}`);
      setChannel(res.data.channel);
      setVideos(res.data.videos || []);
      setIsSubscribed(res.data.channel.isSubscribed || false);
      setSubscriberCount(res.data.channel.subscriberCount || 0);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to load channel');
    } finally {
      setLoading(false);
    }
  }, [handle]);

  useEffect(() => {
    fetchChannelData();
  }, [fetchChannelData]);

  const handleSubscribeToggle = async () => {
    if (!user) {
      navigate('/login');
      return;
    }
    if (!channel) return;

    const prevSub = isSubscribed;
    const prevCount = subscriberCount;
    setIsSubscribed(!prevSub);
    setSubscriberCount(prevSub ? Math.max(0, prevCount - 1) : prevCount + 1);

    try {
      setSubscribing(true);
      if (prevSub) {
        const res = await api.delete(`/channels/${channel.id}/subscription`);
        setSubscriberCount(res.data.subscriberCount);
        setIsSubscribed(false);
      } else {
        const res = await api.put(`/channels/${channel.id}/subscription`);
        setSubscriberCount(res.data.subscriberCount);
        setIsSubscribed(true);
      }
    } catch {
      setIsSubscribed(prevSub);
      setSubscriberCount(prevCount);
    } finally {
      setSubscribing(false);
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

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 text-red-500 animate-spin mb-3" />
        <p className="text-sm text-slate-400">Loading channel...</p>
      </div>
    );
  }

  if (error || !channel) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center space-y-4">
        <div className="w-14 h-14 rounded-full bg-red-500/10 text-red-400 flex items-center justify-center mx-auto">
          <AlertCircle className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold text-white">Channel Not Found</h2>
        <p className="text-sm text-slate-400">{error || 'This channel does not exist.'}</p>
        <Link
          to="/"
          className="inline-block px-5 py-2.5 rounded-full bg-slate-800 hover:bg-slate-700 text-sm font-semibold text-white transition"
        >
          Return Home
        </Link>
      </div>
    );
  }

  const isOwner = user && user.id === channel.id;

  return (
    <div className="space-y-8 max-w-7xl mx-auto py-2">
      {/* Channel Header Banner */}
      <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-slate-900 via-slate-900/90 to-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-red-600/20 text-red-400 border-2 border-red-500/40 flex items-center justify-center text-3xl font-bold flex-shrink-0 shadow-lg shadow-red-600/10">
            {channel.avatarUrl ? (
              <img
                src={channel.avatarUrl}
                alt={channel.displayName}
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              channel.displayName[0]?.toUpperCase() || 'C'
            )}
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              {channel.displayName}
            </h1>
            <div className="flex items-center gap-3 text-xs sm:text-sm text-slate-400 flex-wrap">
              <span className="font-medium text-slate-300">@{channel.handle}</span>
              <span>&bull;</span>
              <span className="flex items-center gap-1">
                <Users className="w-3.5 h-3.5" />
                {subscriberCount.toLocaleString()} {subscriberCount === 1 ? 'subscriber' : 'subscribers'}
              </span>
              <span>&bull;</span>
              <span className="flex items-center gap-1">
                <VideoIcon className="w-3.5 h-3.5" />
                {channel.videoCount} {channel.videoCount === 1 ? 'video' : 'videos'}
              </span>
            </div>
            {channel.bio && (
              <p className="text-xs sm:text-sm text-slate-300 max-w-2xl pt-1 leading-relaxed">
                {channel.bio}
              </p>
            )}
          </div>
        </div>

        {/* Subscribe / Manage Button */}
        <div className="flex items-center gap-3 self-start sm:self-center">
          {isOwner ? (
            <Link
              to="/studio"
              className="px-5 py-2.5 rounded-full bg-slate-800 hover:bg-slate-700 text-xs sm:text-sm font-semibold text-white border border-slate-700 transition"
            >
              Manage in Studio
            </Link>
          ) : (
            <button
              onClick={handleSubscribeToggle}
              disabled={subscribing}
              className={`px-6 py-2.5 rounded-full text-xs sm:text-sm font-semibold transition cursor-pointer flex items-center gap-2 shadow-sm ${
                isSubscribed
                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                  : 'bg-red-600 hover:bg-red-500 text-white shadow-red-600/30'
              }`}
            >
              {isSubscribed ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>Subscribed</span>
                </>
              ) : (
                <span>Subscribe</span>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Videos Section */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-white border-b border-slate-800 pb-3">Videos</h2>

        {videos.length === 0 ? (
          <div className="text-center py-16 px-4 rounded-2xl border border-dashed border-slate-800 bg-slate-900/20">
            <VideoIcon className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-slate-300">No videos uploaded yet</h3>
            <p className="text-xs text-slate-500 mt-1">This creator hasn&apos;t published any public videos.</p>
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
                <div className="px-1 space-y-1">
                  <h3 className="font-semibold text-white text-sm line-clamp-2 leading-snug group-hover:text-red-400 transition">
                    {vid.title}
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span className="flex items-center gap-1">
                      <Eye className="w-3 h-3" />
                      {vid.viewCount?.toLocaleString() || 0}
                    </span>
                    <span>&bull;</span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {timeAgo(vid.publishedAt)}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
