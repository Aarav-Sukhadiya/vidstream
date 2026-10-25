import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import Hls from 'hls.js';
import api from '../api/client';
import { useAuth } from '../hooks/useAuth';
import {
  Eye,
  Calendar,
  AlertTriangle,
  RotateCcw,
  Check,
  Settings,
  Share2,
  ThumbsUp,
  ThumbsDown,
  Loader2,
  MessageSquare,
  CornerDownRight,
  Trash2,
  Send,
  Video as VideoIcon,
} from 'lucide-react';

function formatDuration(sec) {
  if (!sec) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Math.floor((new Date() - new Date(dateStr)) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function Watch() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [video, setVideo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Subscription state
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscriberCount, setSubscriberCount] = useState(0);
  const [subscribing, setSubscribing] = useState(false);

  // Player state
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [levels, setLevels] = useState([]);
  const [currentLevel, setCurrentLevel] = useState(-1); // -1 = Auto
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [streamError, setStreamError] = useState(false);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);

  // Reaction state
  const [userReaction, setUserReaction] = useState(0); // 1 = like, -1 = dislike, 0 = none

  // Comments state
  const [comments, setComments] = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [replyParentId, setReplyParentId] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  // Related videos state
  const [relatedVideos, setRelatedVideos] = useState([]);
  const [relatedLoading, setRelatedLoading] = useState(true);

  // Tracking refs
  const viewCountedRef = useRef(false);
  const playTimeAccumulatedRef = useRef(0);
  const lastTimeRef = useRef(0);
  const progressIntervalRef = useRef(null);

  // 1. Fetch video metadata
  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);
    setStreamError(false);

    api
      .get(`/videos/${id}`)
      .then((res) => {
        if (!isMounted) return;
        setVideo(res.data.video);
        setUserReaction(res.data.video.viewer?.reaction || 0);
        setIsSubscribed(res.data.video.viewer?.subscribed || false);
        setSubscriberCount(res.data.video.channel?.subscriberCount || 0);
      })
      .catch((err) => {
        if (!isMounted) return;
        const status = err.response?.status;
        if (status === 404) {
          setError('This video is private, processing, or does not exist.');
        } else {
          setError(err.response?.data?.error?.message || 'Failed to load video.');
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [id]);

  // 2. Fetch comments
  const fetchComments = useCallback(async () => {
    try {
      setCommentsLoading(true);
      const res = await api.get(`/videos/${id}/comments`);
      setComments(res.data.items || []);
    } catch {
      // ignore comment load errors
    } finally {
      setCommentsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  // 2b. Fetch related videos
  useEffect(() => {
    let isMounted = true;
    setRelatedLoading(true);
    api
      .get(`/videos/${id}/related`)
      .then((res) => {
        if (!isMounted) return;
        setRelatedVideos(res.data.items || []);
      })
      .catch(() => {
        if (!isMounted) return;
        setRelatedVideos([]);
      })
      .finally(() => {
        if (isMounted) setRelatedLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [id]);

  // 3. Initialize HLS player
  useEffect(() => {
    if (!video || !video.hlsUrl || !videoRef.current) return;

    const videoEl = videoRef.current;
    let hls;

    if (Hls.isSupported()) {
      hls = new Hls({
        capLevelToPlayerSize: true,
        autoStartLoad: true,
      });
      hlsRef.current = hls;

      hls.loadSource(video.hlsUrl);
      hls.attachMedia(videoEl);

      hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
        setLevels(data.levels);
        if (video.viewer?.progressSec && video.viewer.progressSec > 0) {
          videoEl.currentTime = video.viewer.progressSec;
        }
      });

      hls.on(Hls.Events.LEVEL_SWITCHED, (event, data) => {
        setCurrentLevel(data.level);
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              setStreamError(true);
              hls.destroy();
              break;
          }
        }
      });
    } else if (videoEl.canPlayType('application/vnd.apple.mpegurl')) {
      videoEl.src = video.hlsUrl;
      videoEl.addEventListener('loadedmetadata', () => {
        if (video.viewer?.progressSec && video.viewer.progressSec > 0) {
          videoEl.currentTime = video.viewer.progressSec;
        }
      });
    } else {
      setStreamError(true);
    }

    return () => {
      if (hls) {
        hls.destroy();
        hlsRef.current = null;
      }
    };
  }, [video]);

  // 4. View counting & accumulation
  const handleTimeUpdate = () => {
    if (!videoRef.current || viewCountedRef.current) return;

    const currentTime = videoRef.current.currentTime;
    const delta = Math.abs(currentTime - lastTimeRef.current);

    if (delta < 2 && isPlaying) {
      playTimeAccumulatedRef.current += delta;
    }
    lastTimeRef.current = currentTime;

    const threshold = video?.durationSec && video.durationSec < 60 ? video.durationSec / 2 : 30;

    if (playTimeAccumulatedRef.current >= threshold && !viewCountedRef.current) {
      viewCountedRef.current = true;
      api
        .post(`/videos/${id}/view`)
        .then((res) => {
          if (res.data.counted) {
            setVideo((prev) => (prev ? { ...prev, viewCount: (prev.viewCount || 0) + 1 } : prev));
          }
        })
        .catch(() => {});
    }
  };

  // 5. Periodic playback progress
  useEffect(() => {
    if (!user || !video) return;

    progressIntervalRef.current = setInterval(() => {
      if (videoRef.current && isPlaying) {
        const positionSec = videoRef.current.currentTime;
        api
          .put(`/videos/${id}/progress`, {
            positionSec,
            durationSec: video.durationSec || 0,
          })
          .catch(() => {});
      }
    }, 10000);

    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, [user, id, video, isPlaying]);

  // 6. Optimistic Like & Dislike
  const handleReaction = async (targetValue) => {
    if (!user) {
      alert('Please sign in to like or dislike videos.');
      return;
    }

    const nextValue = userReaction === targetValue ? 0 : targetValue;
    const previousReaction = userReaction;
    const previousLikeCount = video.likeCount || 0;
    const previousDislikeCount = video.dislikeCount || 0;

    let newLikeCount = previousLikeCount;
    let newDislikeCount = previousDislikeCount;

    if (previousReaction === 1) newLikeCount = Math.max(0, newLikeCount - 1);
    if (previousReaction === -1) newDislikeCount = Math.max(0, newDislikeCount - 1);

    if (nextValue === 1) newLikeCount += 1;
    if (nextValue === -1) newDislikeCount += 1;

    setUserReaction(nextValue);
    setVideo((prev) => ({
      ...prev,
      likeCount: newLikeCount,
      dislikeCount: newDislikeCount,
    }));

    try {
      const res = await api.put(`/videos/${id}/reaction`, { value: nextValue });
      setUserReaction(res.data.userReaction);
      setVideo((prev) => ({
        ...prev,
        likeCount: res.data.likeCount,
        dislikeCount: res.data.dislikeCount,
      }));
    } catch (err) {
      setUserReaction(previousReaction);
      setVideo((prev) => ({
        ...prev,
        likeCount: previousLikeCount,
        dislikeCount: previousDislikeCount,
      }));
      alert(err.response?.data?.error?.message || 'Failed to update reaction');
    }
  };

  // 6b. Optimistic Subscribe & Unsubscribe
  const handleSubscribeToggle = async () => {
    if (!user) {
      navigate('/login');
      return;
    }
    if (!video || !video.channel?.id) return;

    const prevSub = isSubscribed;
    const prevCount = subscriberCount;
    setIsSubscribed(!prevSub);
    setSubscriberCount(prevSub ? Math.max(0, prevCount - 1) : prevCount + 1);

    try {
      setSubscribing(true);
      if (prevSub) {
        const res = await api.delete(`/channels/${video.channel.id}/subscription`);
        setSubscriberCount(res.data.subscriberCount);
        setIsSubscribed(false);
      } else {
        const res = await api.put(`/channels/${video.channel.id}/subscription`);
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

  // 7. Comments handling
  const handleAddComment = async (e, parentId = null) => {
    e.preventDefault();
    const text = parentId ? replyText.trim() : commentText.trim();
    if (!text) return;

    if (!user) {
      alert('Please sign in to comment.');
      return;
    }

    setSubmittingComment(true);
    try {
      const res = await api.post(`/videos/${id}/comments`, {
        body: text,
        parentId,
      });

      if (parentId) {
        setReplyParentId(null);
        setReplyText('');
        fetchComments();
      } else {
        setCommentText('');
        setComments((prev) => [res.data.comment, ...prev]);
        setVideo((prev) => (prev ? { ...prev, commentCount: (prev.commentCount || 0) + 1 } : prev));
      }
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Failed to post comment.');
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!confirm('Are you sure you want to delete this comment?')) return;
    try {
      await api.delete(`/comments/${commentId}`);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      setVideo((prev) =>
        prev ? { ...prev, commentCount: Math.max(0, (prev.commentCount || 0) - 1) } : prev
      );
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Failed to delete comment');
    }
  };

  // 8. Clickable Timestamp Parser (e.g. 02:15, 1:45)
  const seekToTimestamp = (seconds) => {
    if (videoRef.current) {
      videoRef.current.currentTime = seconds;
      videoRef.current.play().catch(() => {});
      videoRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const renderTextWithTimestamps = (text) => {
    const timestampRegex = /\b(?:(\d{1,2}):)?([0-5]?\d):([0-5]\d)\b/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = timestampRegex.exec(text)) !== null) {
      const fullMatch = match[0];
      const matchIndex = match.index;

      if (matchIndex > lastIndex) {
        parts.push(text.substring(lastIndex, matchIndex));
      }

      let totalSec = 0;
      if (match[1]) {
        // hh:mm:ss
        totalSec = parseInt(match[1], 10) * 3600 + parseInt(match[2], 10) * 60 + parseInt(match[3], 10);
      } else {
        // mm:ss
        totalSec = parseInt(match[2], 10) * 60 + parseInt(match[3], 10);
      }

      parts.push(
        <button
          key={matchIndex}
          type="button"
          onClick={() => seekToTimestamp(totalSec)}
          className="text-red-400 hover:text-red-300 font-mono font-semibold hover:underline px-1 py-0.5 rounded bg-red-500/10 transition cursor-pointer"
        >
          {fullMatch}
        </button>
      );

      lastIndex = matchIndex + fullMatch.length;
    }

    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return parts.length > 0 ? parts : text;
  };

  const handleQualityChange = (levelIndex) => {
    if (hlsRef.current) {
      hlsRef.current.currentLevel = levelIndex;
      setCurrentLevel(levelIndex);
      setShowQualityMenu(false);
    }
  };

  const handleReloadPlayer = () => {
    setStreamError(false);
    if (hlsRef.current && video?.hlsUrl) {
      hlsRef.current.loadSource(video.hlsUrl);
      hlsRef.current.attachMedia(videoRef.current);
    }
  };

  if (loading) {
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
        <Link
          to="/"
          className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold rounded-xl transition"
        >
          Return to Home
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto py-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Video & Discussion Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Video Player Wrapper */}
          <div className="relative aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl border border-slate-800 group">
            {streamError ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/90 p-6 text-center">
                <AlertTriangle className="w-10 h-10 text-amber-500 mb-2" />
                <h4 className="text-base font-semibold text-white">Stream Error</h4>
                <p className="text-xs text-slate-400 max-w-sm mt-1 mb-4">
                  There was an issue loading the video segments. Please check your connection or try
                  reloading.
                </p>
                <button
                  onClick={handleReloadPlayer}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-semibold rounded-lg transition"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reload Stream</span>
                </button>
              </div>
            ) : (
              <>
                <video
                  ref={videoRef}
                  controls
                  playsInline
                  poster={video.thumbnailUrl}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onTimeUpdate={handleTimeUpdate}
                  className="w-full h-full object-contain"
                />

                {/* Quality Selector Overlay Button */}
                {levels.length > 1 && (
                  <div className="absolute top-3 right-3 z-30">
                    <button
                      onClick={() => setShowQualityMenu(!showQualityMenu)}
                      className="p-2 rounded-lg bg-black/60 hover:bg-black/80 text-white backdrop-blur transition"
                      title="Quality Settings"
                    >
                      <Settings className="w-4 h-4" />
                    </button>

                    {showQualityMenu && (
                      <div className="absolute right-0 top-10 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl py-1 w-32 text-xs text-slate-200">
                        <button
                          onClick={() => handleQualityChange(-1)}
                          className="w-full px-3 py-2 flex items-center justify-between hover:bg-slate-800 text-left transition"
                        >
                          <span>Auto</span>
                          {currentLevel === -1 && <Check className="w-3.5 h-3.5 text-red-400" />}
                        </button>
                        {levels.map((lvl, idx) => (
                          <button
                            key={lvl.height}
                            onClick={() => handleQualityChange(idx)}
                            className="w-full px-3 py-2 flex items-center justify-between hover:bg-slate-800 text-left transition"
                          >
                            <span>{lvl.height}p</span>
                            {currentLevel === idx && (
                              <Check className="w-3.5 h-3.5 text-red-400" />
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Title & Actions Bar */}
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight leading-snug">
              {video.title}
            </h1>

            <div className="flex flex-wrap items-center justify-between gap-4 mt-3 pb-4 border-b border-slate-800">
              {/* Channel Info & Subscribe Button */}
              <div className="flex items-center gap-3">
                <Link
                  to={`/c/${video.channel?.handle}`}
                  className="flex items-center gap-3 group"
                >
                  <div className="w-10 h-10 rounded-full bg-red-600/20 text-red-400 border border-red-500/30 flex items-center justify-center font-bold text-sm flex-shrink-0 group-hover:border-red-400 transition">
                    {video.channel?.avatarUrl ? (
                      <img
                        src={video.channel.avatarUrl}
                        alt={video.channel.displayName}
                        className="w-full h-full rounded-full object-cover"
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
                      {subscriberCount.toLocaleString()} {subscriberCount === 1 ? 'subscriber' : 'subscribers'}
                    </p>
                  </div>
                </Link>

                {/* Subscribe Button */}
                {(!user || user.id !== video.channel?.id) && (
                  <button
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

              {/* Action Buttons (Like, Dislike, Share) */}
              <div className="flex items-center gap-2">
                <div className="flex items-center bg-slate-900 border border-slate-800 rounded-full overflow-hidden">
                  <button
                    onClick={() => handleReaction(1)}
                    className={`flex items-center gap-1.5 px-3.5 py-1.5 hover:bg-slate-800 text-xs font-semibold border-r border-slate-800 transition cursor-pointer ${
                      userReaction === 1 ? 'text-red-400 bg-red-500/10' : 'text-slate-200'
                    }`}
                  >
                    <ThumbsUp
                      className={`w-4 h-4 ${
                        userReaction === 1 ? 'fill-current text-red-500' : 'text-slate-400'
                      }`}
                    />
                    <span>{video.likeCount || 0}</span>
                  </button>

                  <button
                    onClick={() => handleReaction(-1)}
                    className={`px-3 py-1.5 hover:bg-slate-800 text-xs transition cursor-pointer ${
                      userReaction === -1 ? 'text-red-400 bg-red-500/10' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <ThumbsDown
                      className={`w-4 h-4 ${
                        userReaction === -1 ? 'fill-current text-red-500' : ''
                      }`}
                    />
                  </button>
                </div>

                <button
                  onClick={() => {
                    navigator.clipboard.writeText(window.location.href);
                    alert('Video link copied to clipboard!');
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-200 rounded-full transition cursor-pointer"
                >
                  <Share2 className="w-4 h-4" />
                  <span>Share</span>
                </button>
              </div>
            </div>
          </div>

          {/* Description Box */}
          <div className="p-4 bg-slate-900/60 border border-slate-800/80 rounded-2xl text-sm text-slate-300 space-y-2">
            <div className="flex items-center gap-4 text-xs font-semibold text-slate-400">
              <span className="flex items-center gap-1">
                <Eye className="w-3.5 h-3.5" />
                <span>{video.viewCount || 0} views</span>
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                <span>{new Date(video.publishedAt || video.createdAt).toLocaleDateString()}</span>
              </span>
            </div>

            {video.tags && video.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {video.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-xs font-medium text-red-400 hover:underline cursor-pointer"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}

            <div
              className={`text-slate-200 whitespace-pre-wrap leading-relaxed ${
                !descriptionExpanded ? 'line-clamp-2' : ''
              }`}
            >
              {video.description || 'No description provided.'}
            </div>

            {video.description && video.description.length > 100 && (
              <button
                onClick={() => setDescriptionExpanded(!descriptionExpanded)}
                className="text-xs font-bold text-slate-400 hover:text-white pt-1"
              >
                {descriptionExpanded ? 'Show less' : 'Show more'}
              </button>
            )}
          </div>

          {/* Discussion & Timestamped Comments Section (Checkpoint 16 - Gate 2) */}
          <div className="pt-4 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-red-500" />
                <span>{video.commentCount || comments.length} Comments</span>
              </h2>
            </div>

            {/* Comment Input Box */}
            {user ? (
              <form onSubmit={handleAddComment} className="flex gap-3">
                <div className="w-9 h-9 rounded-full bg-red-600/20 text-red-400 border border-red-500/30 flex items-center justify-center font-bold text-xs flex-shrink-0 mt-0.5">
                  {user.displayName?.[0]?.toUpperCase() || 'U'}
                </div>
                <div className="flex-1 space-y-2">
                  <textarea
                    rows={2}
                    maxLength={1000}
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Add a comment... (Tip: include timestamps like 02:15 to link directly to playback moments!)"
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:border-red-500 resize-none transition"
                  />
                  {commentText.trim() && (
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setCommentText('')}
                        className="px-3.5 py-1.5 text-xs text-slate-400 hover:text-white transition"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={submittingComment}
                        className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-semibold rounded-lg shadow-sm shadow-red-600/30 transition cursor-pointer"
                      >
                        {submittingComment ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Send className="w-3.5 h-3.5" />
                        )}
                        <span>Comment</span>
                      </button>
                    </div>
                  )}
                </div>
              </form>
            ) : (
              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-400 flex items-center justify-between">
                <span>Want to join the conversation? Sign in to post timestamped comments and replies.</span>
                <Link
                  to="/login"
                  className="px-3.5 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg font-semibold"
                >
                  Sign In
                </Link>
              </div>
            )}

            {/* Comments List */}
            {commentsLoading ? (
              <div className="flex justify-center py-6 text-slate-500">
                <Loader2 className="w-6 h-6 animate-spin text-red-500" />
              </div>
            ) : comments.length === 0 ? (
              <p className="text-center py-8 text-xs text-slate-500 italic">
                No comments yet. Be the first to share your thoughts!
              </p>
            ) : (
              <div className="space-y-4">
                {comments.map((comment) => (
                  <div
                    key={comment.id}
                    className="p-4 rounded-xl bg-slate-900/50 border border-slate-800/80 space-y-2 hover:border-slate-700/80 transition"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-slate-800 text-slate-300 border border-slate-700 flex items-center justify-center font-bold text-xs">
                          {comment.author?.displayName?.[0]?.toUpperCase() || 'U'}
                        </div>
                        <div>
                          <span className="text-xs font-semibold text-white mr-1.5">
                            {comment.author?.displayName || 'User'}
                          </span>
                          <span className="text-[11px] text-slate-500">
                            @{comment.author?.handle} &bull;{' '}
                            {new Date(comment.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      {user && user.id === comment.author?.id && (
                        <button
                          onClick={() => handleDeleteComment(comment.id)}
                          title="Delete comment"
                          className="p-1.5 text-slate-500 hover:text-red-400 rounded-lg hover:bg-red-500/10 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Comment Body with Clickable Timestamps */}
                    <div className="text-xs text-slate-200 leading-relaxed pl-9">
                      {renderTextWithTimestamps(comment.body)}
                    </div>

                    {/* Inline Reply Trigger */}
                    <div className="pl-9 pt-1 flex items-center gap-3 text-[11px] text-slate-400">
                      <button
                        onClick={() =>
                          setReplyParentId(replyParentId === comment.id ? null : comment.id)
                        }
                        className="hover:text-white flex items-center gap-1 cursor-pointer"
                      >
                        <CornerDownRight className="w-3 h-3" />
                        <span>Reply</span>
                      </button>
                      {comment.replyCount > 0 && (
                        <span>&bull; {comment.replyCount} {comment.replyCount === 1 ? 'reply' : 'replies'}</span>
                      )}
                    </div>

                    {/* Inline Reply Form */}
                    {replyParentId === comment.id && (
                      <form
                        onSubmit={(e) => handleAddComment(e, comment.id)}
                        className="pl-9 pt-2 flex gap-2"
                      >
                        <input
                          type="text"
                          maxLength={1000}
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          placeholder="Write a reply..."
                          className="flex-1 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-red-500"
                        />
                        <button
                          type="submit"
                          disabled={submittingComment || !replyText.trim()}
                          className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-semibold transition"
                        >
                          Reply
                        </button>
                      </form>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar Column: Related Content */}
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-1 border-b border-slate-800/80">
            <h3 className="font-bold text-sm text-white">Up Next</h3>
            <span className="text-[11px] text-slate-400">Related videos</span>
          </div>

          {relatedLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((n) => (
                <div key={n} className="flex gap-3 animate-pulse p-1">
                  <div className="w-36 h-20 bg-slate-800 rounded-xl flex-shrink-0" />
                  <div className="flex-1 space-y-2 py-1">
                    <div className="h-3.5 bg-slate-800 rounded w-full" />
                    <div className="h-3 bg-slate-800 rounded w-2/3" />
                    <div className="h-2.5 bg-slate-800 rounded w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : relatedVideos.length === 0 ? (
            <div className="p-6 rounded-2xl border border-dashed border-slate-800 bg-slate-900/30 text-center text-xs text-slate-400">
              <p>No related videos found.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {relatedVideos.map((item) => (
                <Link
                  key={item.id}
                  to={`/watch/${item.id}`}
                  className="group flex gap-3 p-1.5 rounded-xl hover:bg-slate-900/80 border border-transparent hover:border-slate-800 transition"
                >
                  <div className="relative w-36 h-20 bg-slate-800 rounded-lg overflow-hidden flex-shrink-0">
                    {item.thumbnailUrl ? (
                      <img
                        src={item.thumbnailUrl}
                        alt={item.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-600">
                        <VideoIcon className="w-6 h-6" />
                      </div>
                    )}
                    <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/80 backdrop-blur text-[10px] font-semibold text-white">
                      {formatDuration(item.durationSec)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0 py-0.5 flex flex-col justify-between">
                    <div>
                      <h4 className="text-xs font-semibold text-slate-200 group-hover:text-red-400 line-clamp-2 transition leading-tight">
                        {item.title}
                      </h4>
                      <p className="text-[11px] text-slate-400 hover:text-slate-300 mt-1 truncate">
                        {item.channel?.displayName || 'Creator'}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-1">
                      <span>{item.viewCount?.toLocaleString() || 0} views</span>
                      <span>&bull;</span>
                      <span>{timeAgo(item.publishedAt)}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
