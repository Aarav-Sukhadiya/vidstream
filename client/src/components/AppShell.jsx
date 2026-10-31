import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import PropTypes from 'prop-types';
import { useAuth } from '../hooks/useAuth';
import { Play, Search, Video, User as UserIcon, LogOut, Menu, X, Users, History as HistoryIcon, ThumbsUp } from 'lucide-react';

export default function AppShell({ children }) {
  const { user, logout } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Keep the search box in sync with the URL and close the mobile menu on navigation
  useEffect(() => {
    setIsMenuOpen(false);
    if (location.pathname === '/search') {
      setSearchQuery(new URLSearchParams(location.search).get('q') || '');
    }
  }, [location.pathname, location.search]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group flex-shrink-0">
            <div className="w-9 h-9 rounded-xl bg-red-600 flex items-center justify-center text-white shadow-md shadow-red-600/30 group-hover:bg-red-500 transition">
              <Play className="w-5 h-5 fill-current ml-0.5" />
            </div>
            <span className="font-bold text-xl tracking-tight text-white group-hover:text-red-400 transition">
              VidStream
            </span>
          </Link>

          {/* Search Bar */}
          <form onSubmit={handleSearch} className="flex-1 max-w-lg hidden sm:block">
            <div className="relative">
              <input
                type="search"
                aria-label="Search videos"
                placeholder="Search lectures, demos, tutorials..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-full text-sm text-slate-100 placeholder-slate-400 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition"
              />
              <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-400" />
            </div>
          </form>

          {/* User Account / Navigation Menu */}
          <div className="flex items-center gap-3">
            {user ? (
              <>
                <Link
                  to="/subscriptions"
                  className="hidden lg:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-full transition"
                >
                  <Users className="w-3.5 h-3.5 text-slate-400" />
                  <span>Subscriptions</span>
                </Link>

                <Link
                  to="/history"
                  className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-full transition"
                >
                  <HistoryIcon className="w-3.5 h-3.5 text-slate-400" />
                  <span>History</span>
                </Link>

                <Link
                  to="/liked"
                  className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-full transition"
                >
                  <ThumbsUp className="w-3.5 h-3.5 text-slate-400" />
                  <span>Liked</span>
                </Link>

                <Link
                  to="/studio"
                  className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-full transition"
                >
                  <span>Studio</span>
                </Link>

                <Link
                  to="/upload"
                  className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-500 rounded-full transition shadow-sm shadow-red-600/20"
                >
                  <Video className="w-3.5 h-3.5" />
                  <span>Upload</span>
                </Link>

                <div className="relative flex items-center gap-3">
                  <Link
                    to={`/c/${user.handle}`}
                    className="flex items-center gap-2 hover:opacity-85 transition"
                    title="View Channel"
                  >
                    <div className="w-8 h-8 rounded-full bg-red-600/20 text-red-400 border border-red-500/30 flex items-center justify-center font-semibold text-sm">
                      {user.displayName?.[0]?.toUpperCase() || 'U'}
                    </div>
                    <div className="hidden md:block text-left text-xs">
                      <div className="font-medium text-slate-200">{user.displayName}</div>
                      <div className="text-slate-400">@{user.handle}</div>
                    </div>
                  </Link>

                  <button
                    onClick={handleLogout}
                    title="Sign Out"
                    aria-label="Sign out"
                    className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  to="/login"
                  className="px-4 py-2 text-sm font-medium text-slate-200 hover:text-white hover:bg-slate-800 rounded-lg transition"
                >
                  Sign in
                </Link>
                <Link
                  to="/register"
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-500 rounded-lg shadow-sm shadow-red-600/30 transition"
                >
                  Register
                </Link>
              </div>
            )}

            {/* Mobile menu toggle */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={isMenuOpen}
              className="sm:hidden p-2 text-slate-400 hover:text-white"
            >
              {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Search & Menu */}
        {isMenuOpen && (
          <div className="sm:hidden px-4 pt-2 pb-4 space-y-3 bg-slate-900 border-b border-slate-800">
            <form onSubmit={handleSearch}>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100 placeholder-slate-400"
                />
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              </div>
            </form>
            {user && (
              <div className="pt-2 flex flex-col gap-2">
                <Link
                  to="/subscriptions"
                  onClick={() => setIsMenuOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800 rounded"
                >
                  <Users className="w-4 h-4 text-slate-400" /> Subscriptions
                </Link>
                <Link
                  to="/history"
                  onClick={() => setIsMenuOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800 rounded"
                >
                  <HistoryIcon className="w-4 h-4 text-slate-400" /> History
                </Link>
                <Link
                  to="/liked"
                  onClick={() => setIsMenuOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800 rounded"
                >
                  <ThumbsUp className="w-4 h-4 text-slate-400" /> Liked Videos
                </Link>
                <Link
                  to="/studio"
                  onClick={() => setIsMenuOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800 rounded"
                >
                  <span>Studio</span>
                </Link>
                <Link
                  to="/upload"
                  onClick={() => setIsMenuOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800 rounded"
                >
                  <Video className="w-4 h-4 text-red-400" /> Upload Video
                </Link>
                <Link
                  to={`/c/${user.handle}`}
                  onClick={() => setIsMenuOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800 rounded"
                >
                  <UserIcon className="w-4 h-4" /> My Channel
                </Link>
              </div>
            )}
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-6 text-center text-xs text-slate-400">
        VidStream &copy; 2026 &middot; Learning Content &amp; Video Discussions
      </footer>
    </div>
  );
}

AppShell.propTypes = {
  children: PropTypes.node.isRequired,
};
