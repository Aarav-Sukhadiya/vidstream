export default function App() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-slate-900 text-white">
      <div className="max-w-md w-full text-center space-y-4">
        <div className="flex items-center justify-center space-x-2">
          <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center font-bold text-white text-lg">
            ▶
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">VidStream</h1>
        </div>
        <p className="text-slate-400">
          Video platform with direct Cloudinary uploads, background HLS transcoding, and live updates.
        </p>
        <div className="inline-block px-3 py-1 text-xs font-semibold rounded-full bg-slate-800 text-slate-300 border border-slate-700">
          Scaffold Ready
        </div>
      </div>
    </div>
  );
}
