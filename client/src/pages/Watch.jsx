import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import {
  Eye,
  Calendar,
  AlertTriangle,
  RotateCcw,
  Check,
  Share2,
  ThumbsUp,
  ThumbsDown,
  Loader2,
} from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../hooks/useAuth';
import { formatCount, apiErrorMessage } from '../utils/format';
import VideoPlayer from '../components/watch/VideoPlayer';
import CommentsSection from '../components/watch/CommentsSection';
import RelatedVideos from '../components/watch/RelatedVideos';

const PROGRESS_SAVE_INTERVAL_MS = 15000;

function useVideo(id) {
  const [video, setVideo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    let active = true;
    setLoading(true);
    setError(null);
    api
      .get(`/videos/${id}`)
      .then((res) => active && setVideo(res.data.video))
      .catch((err) => {
        if (!active) return;
        setVideo(null);
        const status = err.response?.status;
        setError(
          status === 404 || status === 400
            ? 'This video is private, processing, or does not exist.'
            : apiErrorMessage(err, 'Failed to load video.')
        );
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [id]);

  useEffect(() => load(), [load]);

  return { video, setVideo, loading, error, reload: load };
}

export default function Watch() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { video, setVideo, loading, error, reload } = useVideo(id);

  const [userReaction, setUserReaction] = useState(0);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscriberCount, setSubscriberCount] = useState(0);
  const [subscribing, setSubscribing] = useState(false);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const playerRef = useRef(null);
  const viewCountedRef = useRef(false);
  const watchedSecondsRef = useRef(0);
  const lastTimeRef = useRef(0);
  const lastSavedRef = useRef(-1);
  const playbackRef = useRef({ position: 0, duration: 0 });

  // Reset per-video viewer state whenever a new video loads
  const videoId = video?.id;
  useEffect(() => {
    if (!video) return;
    setUserReaction(video.viewer?.reaction || 0);
    setIsSubscribed(!!video.viewer?.subscribed);
    setSubscriberCount(video.channel?.subscriberCount || 0);
    setDescriptionExpanded(false);
    viewCountedRef.current = false;
    watchedSecondsRef.current = 0;
    lastTimeRef.current = 0;
    lastSavedRef.current = -1;
    playbackRef.current = { position: 0, duration: 0 };
    // Only when the video identity changes, not on count updates
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId]);

  const requireLogin = () => navigate('/login', { state: { from: location } });

  // --- Watch progress ---------------------------------------------------------
  // Uses the last known playback position, so it also works after the player unmounts
  const saveProgress = useCallback(() => {
    if (!user || !videoId) return;
    const { position, duration } = playbackRef.current;
    const positionSec = Math.floor(position);
    if (positionSec <= 0 || positionSec === lastSavedRef.current) return;
    lastSavedRef.current = positionSec;
    api
      .put(`/videos/${videoId}/progress`, {
        positionSec,
        durationSec: Math.floor(duration) || 0,
      })
      .catch(() => {});
  }, [user, videoId]);

  // Periodic save while the page is open, plus on tab hide and when leaving the page
  useEffect(() => {
    if (!user || !videoId) return undefined;
    const interval = setInterval(() => {
      if (playerRef.current && !playerRef.current.paused) saveProgress();
    }, PROGRESS_SAVE_INTERVAL_MS);
    const onHide = () => document.visibilityState === 'hidden' && saveProgress();
    document.addEventListener('visibilitychange', onHide);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onHide);
      saveProgress();
    };
  }, [user, videoId, saveProgress]);

  // --- View counting: after 30s of actual playback (or half of short videos) ---
  const handleTimeUpdate = () => {
    const el = playerRef.current;
    if (!el) return;
    playbackRef.current = { position: el.currentTime, duration: el.duration || 0 };
    if (viewCountedRef.current || !videoId) return;

    const delta = el.currentTime - lastTimeRef.current;
    lastTimeRef.current = el.currentTime;
    if (delta > 0 && delta < 2 && !el.paused) watchedSecondsRef.current += delta;

    const duration = video?.durationSec || el.duration || 0;
    const threshold = duration > 0 && duration < 60 ? duration / 2 : 30;
    if (watchedSecondsRef.current < threshold) return;

    viewCountedRef.current = true;
    api
      .post(`/videos/${videoId}/view`)
      .then((res) => {
        if (res.data.counted) {
          setVideo((prev) => (prev ? { ...prev, viewCount: (prev.viewCount || 0) + 1 } : prev));
        }
      })
      .catch(() => {});
  };

  // --- Reactions (optimistic) -------------------------------------------------
  const handleReaction = async (target) => {
    if (!user) return requireLogin();

    const nextValue = userReaction === target ? 0 : target;
    const prev = {
      reaction: userReaction,
      likeCount: video.likeCount || 0,
      dislikeCount: video.dislikeCount || 0,
    };

    const likeCount = prev.likeCount - (prev.reaction === 1 ? 1 : 0) + (nextValue === 1 ? 1 : 0);
    const dislikeCount =
      prev.dislikeCount - (prev.reaction === -1 ? 1 : 0) + (nextValue === -1 ? 1 : 0);
    setUserReaction(nextValue);
    setVideo((v) => ({ ...v, likeCount: Math.max(0, likeCount), dislikeCount: Math.max(0, dislikeCount) }));

    try {
      const res = await api.put(`/videos/${videoId}/reaction`, { value: nextValue });
      setUserReaction(res.data.userReaction);
      setVideo((v) => ({ ...v, likeCount: res.data.likeCount, dislikeCount: res.data.dislikeCount }));
    } catch (err) {
      setUserReaction(prev.reaction);
      setVideo((v) => ({ ...v, likeCount: prev.likeCount, dislikeCount: prev.dislikeCount }));
      alert(apiErrorMessage(err, 'Failed to update reaction'));
    }
  };

  // --- Subscribe (optimistic) -------------------------------------------------
  const handleSubscribeToggle = async () => {
    if (!user) return requireLogin();
    if (!video?.channel?.id || subscribing) return;

    const prevSub = isSubscribed;
    const prevCount = subscriberCount;
    setIsSubscribed(!prevSub);
    setSubscriberCount(prevSub ? Math.max(0, prevCount - 1) : prevCount + 1);
    setSubscribing(true);

    try {
      const url = `/channels/${video.channel.id}/subscription`;
      const res = prevSub ? await api.delete(url) : await api.put(url);
      setSubscriberCount(res.data.subscriberCount);
      setIsSubscribed(res.data.subscribed);
    } catch {
      setIsSubscribed(prevSub);
      setSubscriberCount(prevCount);
    } finally {
      setSubscribing(false);
    }
  };

  const handleShare = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: video.title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // user cancelled the share sheet or clipboard is unavailable
    }
  };

  const seekTo = useCallback((seconds) => {
    const el = playerRef.current;
    if (!el) return;
    el.currentTime = seconds;
    el.play().catch(() => {});
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  const handleCommentCountChange = useCallback(
    (delta) =>
      setVideo((v) => (v ? { ...v, commentCount: Math.max(0, (v.commentCount || 0) + delta) } : v)),
    [setVideo]
  );

  if (loading && !video) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-slate-400">
        <Loader2 className="w-10 h-10 animate-spin text-red-500 mb-3" />
        <p className="text-sm">Loading player &amp; streams...</p>
      </div>
    );
  }

  if (error || !video) {
    return (
      <div className="max-w-3xl mx-auto py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-red-600/10 text-red-500 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Video Unavailable</h2>
        <p className="text-sm text-slate-400 mb-6">{error || 'This video could not be found.'}</p>
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={reload}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white text-sm font-semibold rounded-xl transition cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Retry</span>
          </button>
          <Link
            to="/"
            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold rounded-xl transition"
          >
            Return to Home
          </Link>
        </div>
      </div>
    );
  }

  const isOwner = !!user && user.id === video.channel?.id;
  const isReady = video.status === 'ready' && video.hlsUrl;

  return (
    <div className="max-w-6xl mx-auto py-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6 min-w-0">
          {isReady ? (
            <VideoPlayer
              ref={playerRef}
              src={video.hlsUrl}
              poster={video.thumbnailUrl}
              startAt={video.viewer?.progressSec || 0}
              onPause={saveProgress}
              onTimeUpdate={handleTimeUpdate}
            />
          ) : (
            <div className="aspect-video rounded-2xl bg-slate-900 border border-slate-800 flex flex-col items-center justify-center text-center p-6">
              <Loader2 className="w-8 h-8 animate-spin text-red-500 mb-3" />
              <p className="text-sm font-semibold text-white">This video is {video.status}</p>
              <p className="text-xs text-slate-400 mt-1">
                Only you can see it until processing finishes. Track progress in{' '}
                <Link to="/studio" className="text-red-400 hover:underline">
                  Studio
                </Link>
                .
              </p>
            </div>
          )}

          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight leading-snug break-words">
              {video.title}
            </h1>

            <div className="flex flex-wrap items-center justify-between gap-4 mt-3 pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <Link to={`/c/${video.channel?.handle}`} className="flex items-center gap-3 group">
                  <div className="w-10 h-10 rounded-full bg-red-600/20 text-red-400 border border-red-500/30 flex items-center justify-center font-bold text-sm flex-shrink-0 group-hover:border-red-400 transition overflow-hidden">
                    {video.channel?.avatarUrl ? (
                      <img
                  loading="lazy"
                  decoding="async"
                        src={video.channel.avatarUrl}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      video.channel?.displayName?.[0]?.toUpperCase() || 'C'
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white group-hover:text-red-400 transition">
                      {video.channel?.displayName || 'Creator'}
                    </h3>
                    <p className="text-xs text-slate-400">
                      {formatCount(subscriberCount)}{' '}
                      {subscriberCount === 1 ? 'subscriber' : 'subscribers'}
                    </p>
                  </div>
                </Link>

                {!isOwner && (
                  <button
                    type="button"
                    onClick={handleSubscribeToggle}
                    disabled={subscribing}
                    className={`ml-2 px-4 py-1.5 rounded-full text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 shadow-sm ${
                      isSubscribed
                        ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                        : 'bg-red-600 hover:bg-red-500 text-white shadow-red-600/20'
                    }`}
                  >
                    {isSubscribed ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Subscribed</span>
                      </>
                    ) : (
                      <span>Subscribe</span>
                    )}
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center bg-slate-900 border border-slate-800 rounded-full overflow-hidden">
                  <button
                    type="button"
                    onClick={() => handleReaction(1)}
                    aria-pressed={userReaction === 1}
                    aria-label="Like"
                    className={`flex items-center gap-1.5 px-3.5 py-1.5 hover:bg-slate-800 text-xs font-semibold border-r border-slate-800 transition cursor-pointer ${
                      userReaction === 1 ? 'text-red-400 bg-red-500/10' : 'text-slate-200'
                    }`}
                  >
                    <ThumbsUp
                      className={`w-4 h-4 ${userReaction === 1 ? 'fill-current text-red-500' : 'text-slate-400'}`}
                    />
                    <span>{formatCount(video.likeCount)}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleReaction(-1)}
                    aria-pressed={userReaction === -1}
                    aria-label="Dislike"
                    className={`px-3 py-1.5 hover:bg-slate-800 text-xs transition cursor-pointer ${
                      userReaction === -1 ? 'text-red-400 bg-red-500/10' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <ThumbsDown className={`w-4 h-4 ${userReaction === -1 ? 'fill-current text-red-500' : ''}`} />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleShare}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-200 rounded-full transition cursor-pointer"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4" />}
                  <span>{copied ? 'Link copied' : 'Share'}</span>
                </button>
              </div>
            </div>
          </div>

          <div className="p-4 bg-slate-900/60 border border-slate-800/80 rounded-2xl text-sm text-slate-300 space-y-2">
            <div className="flex items-center gap-4 text-xs font-semibold text-slate-400">
              <span className="flex items-center gap-1">
                <Eye className="w-3.5 h-3.5" />
                <span>{(video.viewCount || 0).toLocaleString()} views</span>
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                <span>{new Date(video.publishedAt || video.createdAt).toLocaleDateString()}</span>
              </span>
            </div>

            {video.tags?.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {video.tags.map((tag) => (
                  <Link
                    key={tag}
                    to={`/search?tag=${encodeURIComponent(tag)}`}
                    className="text-xs font-medium text-red-400 hover:underline"
                  >
                    #{tag}
                  </Link>
                ))}
              </div>
            )}

            <div
              className={`text-slate-200 whitespace-pre-wrap break-words leading-relaxed ${
                !descriptionExpanded ? 'line-clamp-2' : ''
              }`}
            >
              {video.description || 'No description provided.'}
            </div>

            {video.description && video.description.length > 100 && (
              <button
                type="button"
                onClick={() => setDescriptionExpanded((v) => !v)}
                className="text-xs font-bold text-slate-400 hover:text-white pt-1"
              >
                {descriptionExpanded ? 'Show less' : 'Show more'}
              </button>
            )}
          </div>

          <CommentsSection
            videoId={video.id}
            commentCount={video.commentCount || 0}
            onCountChange={handleCommentCountChange}
            onSeek={seekTo}
          />
        </div>

        <RelatedVideos videoId={video.id} />
      </div>
    </div>
  );
}
