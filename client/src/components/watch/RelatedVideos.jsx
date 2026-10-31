import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import { Video as VideoIcon } from 'lucide-react';
import api from '../../api/client';
import { formatDuration, formatCount, timeAgo } from '../../utils/format';

export default function RelatedVideos({ videoId }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api
      .get(`/videos/${videoId}/related`)
      .then((res) => active && setItems(res.data.items || []))
      .catch(() => active && setItems([]))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [videoId]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between pb-1 border-b border-slate-800/80">
        <h3 className="font-bold text-sm text-white">Up Next</h3>
        <span className="text-[11px] text-slate-400">Related videos</span>
      </div>

      {loading ? (
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
      ) : items.length === 0 ? (
        <div className="p-6 rounded-2xl border border-dashed border-slate-800 bg-slate-900/30 text-center text-xs text-slate-400">
          <p>No related videos found.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {items.map((item) => (
            <Link
              key={item.id}
              to={`/watch/${item.id}`}
              className="group flex gap-3 p-1.5 rounded-xl hover:bg-slate-900/80 border border-transparent hover:border-slate-800 transition"
            >
              <div className="relative w-36 h-20 bg-slate-800 rounded-lg overflow-hidden flex-shrink-0">
                {item.thumbnailUrl ? (
                  <img
                    src={item.thumbnailUrl}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-600">
                    <VideoIcon className="w-6 h-6" />
                  </div>
                )}
                <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/80 text-[10px] font-semibold text-white">
                  {formatDuration(item.durationSec)}
                </span>
              </div>
              <div className="flex-1 min-w-0 py-0.5 flex flex-col justify-between">
                <div>
                  <h4 className="text-xs font-semibold text-slate-200 group-hover:text-red-400 line-clamp-2 transition leading-tight">
                    {item.title}
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-1 truncate">
                    {item.channel?.displayName || 'Creator'}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-1">
                  <span>{formatCount(item.viewCount)} views</span>
                  <span>&bull;</span>
                  <span>{timeAgo(item.publishedAt)}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

RelatedVideos.propTypes = {
  videoId: PropTypes.string.isRequired,
};
