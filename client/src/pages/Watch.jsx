import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
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
} from 'lucide-react';

export default function Watch() {
  const { id } = useParams();
  const { user } = useAuth();

  const [video, setVideo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Player state
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [levels, setLevels] = useState([]);
  const [currentLevel, setCurrentLevel] = useState(-1); // -1 = Auto
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [streamError, setStreamError] = useState(false);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);

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

  // 2. Initialize HLS player
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
        // Resume saved playback position if available
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
      // Native Safari HLS
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

  // 3. View counting & play time accumulation
  const handleTimeUpdate = () => {
    if (!videoRef.current || viewCountedRef.current) return;

    const currentTime = videoRef.current.currentTime;
    const delta = Math.abs(currentTime - lastTimeRef.current);

    // If reasonable delta (not seeking), accumulate play time
    if (delta < 2 && isPlaying) {
      playTimeAccumulatedRef.current += delta;
    }
    lastTimeRef.current = currentTime;

    // Trigger threshold: 30s or half the video duration if under 60s
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

  // 4. Save playback position every 10s if authenticated
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
        {/* Main Video & Details Column */}
        <div className="lg:col-span-2 space-y-5">
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

          {/* Title & Stats */}
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight leading-snug">
              {video.title}
            </h1>

            <div className="flex flex-wrap items-center justify-between gap-4 mt-3 pb-4 border-b border-slate-800">
              {/* Channel Info */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-600/20 text-red-400 border border-red-500/30 flex items-center justify-center font-bold text-sm">
                  {video.channel?.displayName?.[0]?.toUpperCase() || 'C'}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">
                    {video.channel?.displayName || 'Creator'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {video.channel?.subscriberCount || 0} subscribers
                  </p>
                </div>
              </div>

              {/* Action Buttons (Likes, Share) */}
              <div className="flex items-center gap-2">
                <div className="flex items-center bg-slate-900 border border-slate-800 rounded-full overflow-hidden">
                  <button className="flex items-center gap-1.5 px-3.5 py-1.5 hover:bg-slate-800 text-xs font-semibold text-slate-200 border-r border-slate-800 transition">
                    <ThumbsUp className="w-4 h-4 text-slate-400" />
                    <span>{video.likeCount || 0}</span>
                  </button>
                  <button className="px-3 py-1.5 hover:bg-slate-800 text-xs text-slate-400 hover:text-white transition">
                    <ThumbsDown className="w-4 h-4" />
                  </button>
                </div>

                <button
                  onClick={() => {
                    navigator.clipboard.writeText(window.location.href);
                    alert('Video link copied to clipboard!');
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-200 rounded-full transition"
                >
                  <Share2 className="w-4 h-4" />
                  <span>Share</span>
                </button>
              </div>
            </div>
          </div>

          {/* Expandable Description Box */}
          <div className="p-4 bg-slate-900/60 border border-slate-800/80 rounded-2xl text-sm text-slate-300 space-y-2">
            <div className="flex items-center gap-4 text-xs font-semibold text-slate-400">
              <span className="flex items-center gap-1">
                <Eye className="w-3.5 h-3.5" />
                <span>{video.viewCount || 0} views</span>
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                <span>
                  {new Date(video.publishedAt || video.createdAt).toLocaleDateString()}
                </span>
              </span>
            </div>

            {/* Tags */}
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
        </div>

        {/* Sidebar Column: Related Content */}
        <div className="space-y-4">
          <h3 className="font-bold text-base text-white">Up Next</h3>
          <div className="p-6 rounded-2xl border border-dashed border-slate-800 bg-slate-900/30 text-center text-xs text-slate-400">
            <p>Related videos and recommendations are updated dynamically based on tags.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
