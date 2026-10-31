/** 125 -> "2:05", 3725 -> "1:02:05" */
export function formatDuration(sec) {
  const total = Math.max(0, Math.floor(Number(sec) || 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

const UNITS = [
  ['y', 365 * 24 * 3600],
  ['mo', 30 * 24 * 3600],
  ['w', 7 * 24 * 3600],
  ['d', 24 * 3600],
  ['h', 3600],
  ['m', 60],
];

/** Compact relative time: "just now", "5m ago", "3d ago", "2mo ago" */
export function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return 'just now';
  for (const [label, seconds] of UNITS) {
    if (diff >= seconds) return `${Math.floor(diff / seconds)}${label} ago`;
  }
  return 'just now';
}

const compact = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 });

/** 1234 -> "1.2K" */
export function formatCount(n) {
  return compact.format(Number(n) || 0);
}

/** Extract the API error message from an axios error. */
export function apiErrorMessage(err, fallback = 'Something went wrong') {
  return err?.response?.data?.error?.message || fallback;
}
