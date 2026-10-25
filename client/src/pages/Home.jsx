import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Video, ShieldCheck, Sparkles, User, LogOut } from 'lucide-react';

export default function Home() {
  const { user, logout } = useAuth();

  return (
    <div className="space-y-8 max-w-4xl mx-auto py-4">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-8 rounded-2xl border border-slate-800 shadow-xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
              <Sparkles className="w-3.5 h-3.5" />
              <span>VidStream MERN Platform</span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white">
              {user ? `Welcome back, ${user.displayName}!` : 'Learn, Share & Discuss Video Moments'}
            </h1>
            <p className="text-slate-400 max-w-xl text-sm leading-relaxed">
              {user
                ? `You are signed in as @${user.handle}. Your session is active and persists across reloads via rotating httpOnly refresh tokens.`
                : 'A video platform with direct signed Cloudinary uploads, background HLS multi-rendition transcoding, and timestamped discussions.'}
            </p>
          </div>

          {user ? (
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
              <Link
                to="/upload"
                className="w-full sm:w-auto px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white font-medium text-sm rounded-xl shadow-lg shadow-red-600/30 transition flex items-center justify-center gap-2"
              >
                <Video className="w-4 h-4" />
                <span>Upload Video</span>
              </Link>
              <button
                onClick={logout}
                className="w-full sm:w-auto px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-medium text-sm rounded-xl border border-slate-700 transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
              <Link
                to="/register"
                className="w-full sm:w-auto px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white font-medium text-sm rounded-xl shadow-lg shadow-red-600/30 transition text-center"
              >
                Get Started
              </Link>
              <Link
                to="/login"
                className="w-full sm:w-auto px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-sm rounded-xl border border-slate-700 transition text-center"
              >
                Sign In
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* User Session Status Card */}
      {user && (
        <div className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-600/20 text-red-400 border border-red-500/30 flex items-center justify-center font-bold">
              {user.displayName?.[0]?.toUpperCase()}
            </div>
            <div>
              <h3 className="font-semibold text-white">{user.displayName}</h3>
              <p className="text-xs text-slate-400">@{user.handle} &bull; {user.email}</p>
            </div>
            <div className="ml-auto inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Session Authenticated</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/80">
              <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Subscribers</span>
              <p className="text-2xl font-bold text-white mt-1">{user.subscriberCount || 0}</p>
            </div>
            <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/80">
              <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Bio</span>
              <p className="text-sm text-slate-300 mt-1 italic truncate">
                {user.bio || 'No bio set'}
              </p>
            </div>
            <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/80">
              <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Channel URL</span>
              <Link to={`/c/${user.handle}`} className="text-sm text-red-400 hover:underline block mt-1 truncate">
                /c/{user.handle}
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Feature Pillars */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800/80 space-y-2">
          <div className="w-9 h-9 rounded-lg bg-red-500/10 text-red-400 flex items-center justify-center">
            <Video className="w-5 h-5" />
          </div>
          <h3 className="font-semibold text-white">Direct Signed Uploads</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Fast, resilient direct-to-cloud uploads with real-time XHR progress tracking.
          </p>
        </div>

        <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800/80 space-y-2">
          <div className="w-9 h-9 rounded-lg bg-red-500/10 text-red-400 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h3 className="font-semibold text-white">HLS Adaptive Streaming</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Asynchronous multi-rendition 360p &amp; 720p transcoding with thumbnail generation.
          </p>
        </div>

        <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800/80 space-y-2">
          <div className="w-9 h-9 rounded-lg bg-red-500/10 text-red-400 flex items-center justify-center">
            <User className="w-5 h-5" />
          </div>
          <h3 className="font-semibold text-white">Timestamped Discussions</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Discuss exact moments in educational videos with clickable seek links.
          </p>
        </div>
      </div>
    </div>
  );
}
