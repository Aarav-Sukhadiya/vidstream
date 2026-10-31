import { useCallback, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Link, useLocation } from 'react-router-dom';
import { Loader2, MessageSquare, CornerDownRight, Trash2, Send, ChevronDown } from 'lucide-react';
import api from '../../api/client';
import { useAuth } from '../../hooks/useAuth';
import { timeAgo, apiErrorMessage } from '../../utils/format';

const TIMESTAMP_REGEX = /\b(?:(\d{1,2}):)?([0-5]?\d):([0-5]\d)\b/g;

/** Turn "1:23" / "01:02:03" in comment text into buttons that seek the player. */
function TextWithTimestamps({ text, onSeek }) {
  const parts = [];
  let lastIndex = 0;
  for (const match of text.matchAll(TIMESTAMP_REGEX)) {
    const [full, h, m, s] = match;
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    const seconds = (parseInt(h || '0', 10) * 60 + parseInt(m, 10)) * 60 + parseInt(s, 10);
    parts.push(
      <button
        key={match.index}
        type="button"
        onClick={() => onSeek(seconds)}
        className="text-red-400 hover:text-red-300 font-mono font-semibold hover:underline px-1 py-0.5 rounded bg-red-500/10 transition cursor-pointer"
      >
        {full}
      </button>
    );
    lastIndex = match.index + full.length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return <>{parts}</>;
}

TextWithTimestamps.propTypes = {
  text: PropTypes.string.isRequired,
  onSeek: PropTypes.func.isRequired,
};

function Avatar({ name, size = 'w-7 h-7' }) {
  return (
    <div
      className={`${size} rounded-full bg-slate-800 text-slate-300 border border-slate-700 flex items-center justify-center font-bold text-xs flex-shrink-0`}
    >
      {name?.[0]?.toUpperCase() || 'U'}
    </div>
  );
}

Avatar.propTypes = { name: PropTypes.string, size: PropTypes.string };

/** Fetch one page of comments (top-level, or replies when parentId is given). */
async function fetchPage(videoId, { parentId, cursor } = {}) {
  const params = { limit: 20 };
  if (parentId) params.parentId = parentId;
  if (cursor) params.cursor = cursor;
  const res = await api.get(`/videos/${videoId}/comments`, { params });
  return { items: res.data.items || [], nextCursor: res.data.nextCursor || null };
}

function CommentItem({ comment, videoId, onSeek, onDeleted, onReplyAdded, isReply = false }) {
  const { user } = useAuth();
  const [replying, setReplying] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [replies, setReplies] = useState(null); // null = not loaded
  const [repliesCursor, setRepliesCursor] = useState(null);
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [showReplies, setShowReplies] = useState(false);

  const loadReplies = async (cursor = null) => {
    setLoadingReplies(true);
    try {
      const page = await fetchPage(videoId, { parentId: comment.id, cursor });
      setReplies((prev) => (cursor && prev ? [...prev, ...page.items] : page.items));
      setRepliesCursor(page.nextCursor);
    } catch {
      // keep whatever is already shown
    } finally {
      setLoadingReplies(false);
    }
  };

  const toggleReplies = () => {
    const next = !showReplies;
    setShowReplies(next);
    if (next && replies === null) loadReplies();
  };

  const submitReply = async (e) => {
    e.preventDefault();
    const body = replyText.trim();
    if (!body) return;
    setSubmitting(true);
    try {
      const res = await api.post(`/videos/${videoId}/comments`, { body, parentId: comment.id });
      setReplyText('');
      setReplying(false);
      onReplyAdded(comment.id, res.data.comment);
      if (!isReply) {
        setReplies((prev) => [...(prev || []), res.data.comment]);
        setShowReplies(true);
      }
    } catch (err) {
      alert(apiErrorMessage(err, 'Failed to post reply.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this comment?')) return;
    try {
      const res = await api.delete(`/comments/${comment.id}`);
      onDeleted(comment, res.data.deletedCount || 1);
    } catch (err) {
      alert(apiErrorMessage(err, 'Failed to delete comment'));
    }
  };

  const handleReplyDeleted = (reply, count) => {
    setReplies((prev) => (prev || []).filter((r) => r.id !== reply.id));
    onDeleted(reply, count, comment.id);
  };

  return (
    <div
      className={
        isReply
          ? 'space-y-1.5'
          : 'p-4 rounded-xl bg-slate-900/50 border border-slate-800/80 space-y-2 hover:border-slate-700/80 transition'
      }
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Avatar name={comment.author?.displayName} />
          <div>
            <Link
              to={`/c/${comment.author?.handle}`}
              className="text-xs font-semibold text-white mr-1.5 hover:text-red-400"
            >
              {comment.author?.displayName || 'User'}
            </Link>
            <span className="text-[11px] text-slate-500" title={new Date(comment.createdAt).toLocaleString()}>
              @{comment.author?.handle} &bull; {timeAgo(comment.createdAt)}
            </span>
          </div>
        </div>

        {user && user.id === comment.author?.id && (
          <button
            type="button"
            onClick={handleDelete}
            title="Delete comment"
            aria-label="Delete comment"
            className="p-1.5 text-slate-500 hover:text-red-400 rounded-lg hover:bg-red-500/10 transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="text-xs text-slate-200 leading-relaxed pl-9 whitespace-pre-wrap break-words">
        <TextWithTimestamps text={comment.body} onSeek={onSeek} />
      </div>

      <div className="pl-9 pt-1 flex items-center gap-3 text-[11px] text-slate-400">
        {user && (
          <button
            type="button"
            onClick={() => setReplying((v) => !v)}
            className="hover:text-white flex items-center gap-1 cursor-pointer"
          >
            <CornerDownRight className="w-3 h-3" />
            <span>Reply</span>
          </button>
        )}
        {!isReply && comment.replyCount > 0 && (
          <button
            type="button"
            onClick={toggleReplies}
            className="hover:text-white flex items-center gap-1 cursor-pointer"
          >
            <ChevronDown className={`w-3 h-3 transition ${showReplies ? 'rotate-180' : ''}`} />
            <span>
              {showReplies ? 'Hide' : 'View'} {comment.replyCount}{' '}
              {comment.replyCount === 1 ? 'reply' : 'replies'}
            </span>
          </button>
        )}
      </div>

      {replying && (
        <form onSubmit={submitReply} className="pl-9 pt-2 flex gap-2">
          <input
            type="text"
            maxLength={1000}
            autoFocus
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="Write a reply..."
            aria-label="Reply"
            className="flex-1 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-red-500"
          />
          <button
            type="submit"
            disabled={submitting || !replyText.trim()}
            className="px-3 py-1.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition"
          >
            Reply
          </button>
        </form>
      )}

      {!isReply && showReplies && (
        <div className="pl-9 pt-2 space-y-3 border-l border-slate-800 ml-3">
          {(replies || []).map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              videoId={videoId}
              onSeek={onSeek}
              onDeleted={handleReplyDeleted}
              onReplyAdded={(_, newReply) => {
                setReplies((prev) => [...(prev || []), newReply]);
                onReplyAdded(comment.id, newReply);
              }}
              isReply
            />
          ))}
          {loadingReplies && <Loader2 className="w-4 h-4 animate-spin text-red-500" />}
          {repliesCursor && !loadingReplies && (
            <button
              type="button"
              onClick={() => loadReplies(repliesCursor)}
              className="text-[11px] font-semibold text-slate-400 hover:text-white"
            >
              Show more replies
            </button>
          )}
        </div>
      )}
    </div>
  );
}

CommentItem.propTypes = {
  comment: PropTypes.object.isRequired,
  videoId: PropTypes.string.isRequired,
  onSeek: PropTypes.func.isRequired,
  onDeleted: PropTypes.func.isRequired,
  onReplyAdded: PropTypes.func.isRequired,
  isReply: PropTypes.bool,
};

export default function CommentsSection({ videoId, commentCount, onCountChange, onSeek }) {
  const { user } = useAuth();
  const location = useLocation();
  const [comments, setComments] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setComments([]);
    fetchPage(videoId)
      .then((page) => {
        if (!active) return;
        setComments(page.items);
        setNextCursor(page.nextCursor);
      })
      .catch(() => {})
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [videoId]);

  const loadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await fetchPage(videoId, { cursor: nextCursor });
      setComments((prev) => [...prev, ...page.items]);
      setNextCursor(page.nextCursor);
    } catch {
      // ignore
    } finally {
      setLoadingMore(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setSubmitting(true);
    try {
      const res = await api.post(`/videos/${videoId}/comments`, { body });
      setText('');
      setComments((prev) => [res.data.comment, ...prev]);
      onCountChange(1);
    } catch (err) {
      alert(apiErrorMessage(err, 'Failed to post comment.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleted = useCallback(
    (comment, deletedCount, parentId) => {
      if (parentId) {
        setComments((prev) =>
          prev.map((c) =>
            c.id === parentId ? { ...c, replyCount: Math.max(0, c.replyCount - 1) } : c
          )
        );
      } else {
        setComments((prev) => prev.filter((c) => c.id !== comment.id));
      }
      onCountChange(-deletedCount);
    },
    [onCountChange]
  );

  const handleReplyAdded = useCallback(
    (parentId) => {
      setComments((prev) =>
        prev.map((c) => (c.id === parentId ? { ...c, replyCount: (c.replyCount || 0) + 1 } : c))
      );
      onCountChange(1);
    },
    [onCountChange]
  );

  return (
    <div className="pt-4 space-y-6">
      <h2 className="text-lg font-bold text-white flex items-center gap-2">
        <MessageSquare className="w-5 h-5 text-red-500" />
        <span>
          {commentCount} {commentCount === 1 ? 'Comment' : 'Comments'}
        </span>
      </h2>

      {user ? (
        <form onSubmit={submit} className="flex gap-3">
          <div className="w-9 h-9 rounded-full bg-red-600/20 text-red-400 border border-red-500/30 flex items-center justify-center font-bold text-xs flex-shrink-0 mt-0.5">
            {user.displayName?.[0]?.toUpperCase() || 'U'}
          </div>
          <div className="flex-1 space-y-2">
            <textarea
              rows={2}
              maxLength={1000}
              value={text}
              onChange={(e) => setText(e.target.value)}
              aria-label="Add a comment"
              placeholder="Add a comment... (Tip: include timestamps like 02:15 to link directly to playback moments!)"
              className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:border-red-500 resize-none transition"
            />
            {text.trim() && (
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setText('')}
                  className="px-3.5 py-1.5 text-xs text-slate-400 hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-sm shadow-red-600/30 transition cursor-pointer"
                >
                  {submitting ? (
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
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-400 flex items-center justify-between gap-3">
          <span>Want to join the conversation? Sign in to post timestamped comments and replies.</span>
          <Link
            to="/login"
            state={{ from: location }}
            className="px-3.5 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg font-semibold flex-shrink-0"
          >
            Sign In
          </Link>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="w-6 h-6 animate-spin text-red-500" />
        </div>
      ) : comments.length === 0 ? (
        <p className="text-center py-8 text-xs text-slate-500 italic">
          No comments yet. Be the first to share your thoughts!
        </p>
      ) : (
        <div className="space-y-4">
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              videoId={videoId}
              onSeek={onSeek}
              onDeleted={handleDeleted}
              onReplyAdded={handleReplyAdded}
            />
          ))}
          {nextCursor && (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={loadMore}
                disabled={loadingMore}
                className="px-4 py-2 rounded-full bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition flex items-center gap-2"
              >
                {loadingMore && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Load more comments
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

CommentsSection.propTypes = {
  videoId: PropTypes.string.isRequired,
  commentCount: PropTypes.number.isRequired,
  onCountChange: PropTypes.func.isRequired,
  onSeek: PropTypes.func.isRequired,
};
