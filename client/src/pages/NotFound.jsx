import { Link } from 'react-router-dom';
import { Play } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4 space-y-4">
      <div className="w-16 h-16 rounded-2xl bg-red-600/10 text-red-500 border border-red-500/20 flex items-center justify-center text-2xl font-bold">
        404
      </div>
      <h1 className="text-2xl font-bold text-white">Page Not Found</h1>
      <p className="text-slate-400 text-sm max-w-sm">
        The page you are looking for does not exist or may have been moved.
      </p>
      <Link
        to="/"
        className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-medium text-sm rounded-lg shadow-md transition"
      >
        <Play className="w-4 h-4 fill-current" />
        <span>Back to Home</span>
      </Link>
    </div>
  );
}
