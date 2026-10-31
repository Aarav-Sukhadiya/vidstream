import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import PropTypes from 'prop-types';
// Light build: no DRM, subtitles or alternate audio, which VidStream doesn't use
import Hls from 'hls.js/light';
import { AlertTriangle, RotateCcw, Settings, Check } from 'lucide-react';

const MAX_NETWORK_RETRIES = 3;

/**
 * HLS player with quality selection, resume position and error recovery.
 * Only re-initialises when the stream URL changes (or the user reloads it),
 * never on unrelated metadata updates such as like or view counts.
 */
const VideoPlayer = forwardRef(function VideoPlayer(
  { src, poster, startAt, onPlay, onPause, onTimeUpdate },
  ref
) {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const startAtRef = useRef(startAt);
  const [levels, setLevels] = useState([]);
  const [currentLevel, setCurrentLevel] = useState(-1); // -1 = Auto
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [streamError, setStreamError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useImperativeHandle(ref, () => videoRef.current, []);

  useEffect(() => {
    const videoEl = videoRef.current;
    if (!src || !videoEl) return undefined;

    setStreamError(false);
    setLevels([]);
    setCurrentLevel(-1);

    const resume = () => {
      const at = startAtRef.current;
      // Don't resume into the last few seconds: start over instead
      if (at > 0 && (!videoEl.duration || at < videoEl.duration - 5)) {
        videoEl.currentTime = at;
      }
      startAtRef.current = 0;
    };

    let hls = null;
    if (Hls.isSupported()) {
      let networkRetries = 0;
      hls = new Hls({ capLevelToPlayerSize: true });
      hlsRef.current = hls;
      hls.loadSource(src);
      hls.attachMedia(videoEl);

      hls.on(Hls.Events.MANIFEST_PARSED, (_e, data) => {
        setLevels(data.levels);
        resume();
      });
      hls.on(Hls.Events.LEVEL_SWITCHED, (_e, data) => {
        if (hls.autoLevelEnabled) setCurrentLevel(-1);
        else setCurrentLevel(data.level);
      });
      hls.on(Hls.Events.FRAG_LOADED, () => {
        networkRetries = 0;
      });
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (!data.fatal) return;
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR && networkRetries < MAX_NETWORK_RETRIES) {
          networkRetries += 1;
          hls.startLoad();
        } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          hls.recoverMediaError();
        } else {
          setStreamError(true);
          hls.destroy();
          hlsRef.current = null;
        }
      });
    } else if (videoEl.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari plays HLS natively
      videoEl.src = src;
      videoEl.addEventListener('loadedmetadata', resume, { once: true });
    } else {
      setStreamError(true);
    }

    return () => {
      videoEl.removeEventListener('loadedmetadata', resume);
      if (hls) {
        hls.destroy();
        hlsRef.current = null;
      } else {
        videoEl.removeAttribute('src');
        videoEl.load();
      }
    };
  }, [src, reloadKey]);

  const handleQualityChange = (levelIndex) => {
    if (hlsRef.current) {
      hlsRef.current.currentLevel = levelIndex;
      setCurrentLevel(levelIndex);
    }
    setShowQualityMenu(false);
  };

  const handleReload = () => {
    startAtRef.current = videoRef.current?.currentTime || 0;
    setReloadKey((k) => k + 1);
  };

  return (
    <div className="relative aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl border border-slate-800">
      <video
        ref={videoRef}
        controls
        playsInline
        preload="metadata"
        poster={poster}
        onPlay={onPlay}
        onPause={onPause}
        onTimeUpdate={onTimeUpdate}
        className="w-full h-full object-contain"
      />

      {streamError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/95 p-6 text-center">
          <AlertTriangle className="w-10 h-10 text-amber-500 mb-2" />
          <h4 className="text-base font-semibold text-white">Stream Error</h4>
          <p className="text-xs text-slate-400 max-w-sm mt-1 mb-4">
            There was an issue loading the video segments. Please check your connection or try
            reloading.
          </p>
          <button
            type="button"
            onClick={handleReload}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-semibold rounded-lg transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reload Stream</span>
          </button>
        </div>
      )}

      {!streamError && levels.length > 1 && (
        <div className="absolute top-3 right-3 z-30">
          <button
            type="button"
            onClick={() => setShowQualityMenu((v) => !v)}
            className="p-2 rounded-lg bg-black/60 hover:bg-black/80 text-white backdrop-blur transition"
            title="Quality settings"
            aria-label="Quality settings"
            aria-expanded={showQualityMenu}
          >
            <Settings className="w-4 h-4" />
          </button>

          {showQualityMenu && (
            <div className="absolute right-0 top-10 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl py-1 w-32 text-xs text-slate-200">
              {[{ label: 'Auto', index: -1 }, ...levels.map((l, i) => ({ label: `${l.height}p`, index: i }))].map(
                ({ label, index }) => (
                  <button
                    type="button"
                    key={index}
                    onClick={() => handleQualityChange(index)}
                    className="w-full px-3 py-2 flex items-center justify-between hover:bg-slate-800 text-left transition"
                  >
                    <span>{label}</span>
                    {currentLevel === index && <Check className="w-3.5 h-3.5 text-red-400" />}
                  </button>
                )
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

VideoPlayer.propTypes = {
  src: PropTypes.string,
  poster: PropTypes.string,
  startAt: PropTypes.number,
  onPlay: PropTypes.func,
  onPause: PropTypes.func,
  onTimeUpdate: PropTypes.func,
};

export default VideoPlayer;
