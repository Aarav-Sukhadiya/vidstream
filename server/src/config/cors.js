/**
 * Allowed browser origins, from CLIENT_ORIGIN (comma-separated for several,
 * e.g. "https://vidstream.vercel.app,http://localhost:5173").
 */
function getAllowedOrigins() {
  return (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim().replace(/\/$/, ''))
    .filter(Boolean);
}

function getCorsOptions() {
  const origins = getAllowedOrigins();
  return {
    origin: origins.length === 1 ? origins[0] : origins,
    credentials: true,
  };
}

module.exports = { getAllowedOrigins, getCorsOptions };
