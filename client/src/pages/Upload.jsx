import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import {
  Upload as UploadIcon,
  Video,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileVideo,
  X,
} from 'lucide-react';
import { io } from 'socket.io-client';

const MAX_UPLOAD_MB = 100;
const ALLOWED_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];

export default function Upload() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    tags: '',
    visibility: 'public',
  });
  const [selectedFile, setSelectedFile] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');

  // Upload progress and pipeline state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [videoStatus, setVideoStatus] = useState(null); // 'awaiting_upload' | 'queued' | 'processing' | 'ready' | 'failed'
  const [createdVideoId, setCreatedVideoId] = useState(null);

  // Socket.IO for real-time status updates
  useEffect(() => {
    const socket = io('/', {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
    });

    socket.on('video:status', (data) => {
      if (data.videoId === createdVideoId) {
        setVideoStatus(data.status);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [createdVideoId]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) {
      setFieldErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const handleFileSelect = (file) => {
    setError('');
    setFieldErrors({});

    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      setError('Invalid format. Please select an MP4, MOV, or WebM video file.');
      return;
    }

    if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
      setError(`File size exceeds the ${MAX_UPLOAD_MB}MB limit.`);
      return;
    }

    setSelectedFile(file);
    if (!formData.title) {
      // Auto-populate title from file name without extension
      const defaultTitle = file.name.replace(/\.[^/.]+$/, '');
      setFormData((prev) => ({ ...prev, title: defaultTitle.slice(0, 100) }));
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});

    if (!selectedFile) {
      setError('Please select a video file to upload.');
      return;
    }

    // Process tags into an array
    const tagList = formData.tags
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t.length > 0)
      .slice(0, 10);

    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Step 1: Request signed upload parameters from our API
      const initRes = await api.post('/videos', {
        title: formData.title,
        description: formData.description,
        tags: tagList,
        visibility: formData.visibility,
        fileName: selectedFile.name,
        contentType: selectedFile.type,
        sizeBytes: selectedFile.size,
      });

      const { video, upload } = initRes.data;
      setCreatedVideoId(video.id);
      setVideoStatus('awaiting_upload');

      // Step 2: Perform direct upload to Cloudinary via XMLHttpRequest with progress tracking
      await uploadToStorage(upload, selectedFile);

      // Step 3: Confirm upload to enqueue transcoding job
      const confirmRes = await api.post(`/videos/${video.id}/confirm`, {
        public_id: upload.fields.public_id || `vidstream/raw/${video.id}`,
      });

      setVideoStatus(confirmRes.data.video.status);
    } catch (err) {
      console.error('Upload error:', err);
      const resError = err.response?.data?.error;
      if (resError) {
        setError(resError.message || 'Upload failed');
        if (resError.fields) {
          setFieldErrors(resError.fields);
        }
      } else {
        setError(err.message || 'An error occurred during upload. Please try again.');
      }
      setIsUploading(false);
    }
  };

  // Direct storage upload with XMLHttpRequest
  const uploadToStorage = (uploadConfig, file) => {
    return new Promise((resolve, reject) => {
      // If mock cloud in development, simulate upload progress
      if (uploadConfig.url.includes('mock_cloud')) {
        let progress = 0;
        const interval = setInterval(() => {
          progress += 25;
          setUploadProgress(progress);
          if (progress >= 100) {
            clearInterval(interval);
            resolve();
          }
        }, 150);
        return;
      }

      const xhr = new XMLHttpRequest();
      const formDataUpload = new FormData();

      Object.entries(uploadConfig.fields).forEach(([key, val]) => {
        formDataUpload.append(key, val);
      });
      formDataUpload.append('file', file);

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const percent = Math.round((e.loaded / e.total) * 100);
          setUploadProgress(percent);
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          reject(new Error(`Storage rejected upload: ${xhr.statusText}`));
        }
      };

      xhr.onerror = () => reject(new Error('Network error during file upload'));
      xhr.open(uploadConfig.method || 'POST', uploadConfig.url, true);
      xhr.send(formDataUpload);
    });
  };

  return (
    <div className="max-w-3xl mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <UploadIcon className="w-6 h-6 text-red-500" />
          <span>Upload Video</span>
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Direct signed upload with background HLS multi-rendition transcoding.
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-3 text-sm text-red-400">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>{error}</div>
        </div>
      )}

      {/* Upload Complete / In-Progress Pipeline View */}
      {videoStatus && (
        <div className="mb-8 p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {uploadProgress < 100 ? (
                <Loader2 className="w-6 h-6 text-red-500 animate-spin" />
              ) : (
                <CheckCircle2 className="w-6 h-6 text-emerald-400" />
              )}
              <div>
                <h3 className="font-semibold text-white">
                  {uploadProgress < 100 ? 'Uploading to Storage...' : 'Upload Successful!'}
                </h3>
                <p className="text-xs text-slate-400">
                  Status:{' '}
                  <span className="font-mono uppercase font-bold text-slate-200">
                    {videoStatus}
                  </span>
                </p>
              </div>
            </div>

            {uploadProgress === 100 && (
              <button
                onClick={() => navigate('/')}
                className="px-4 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg transition"
              >
                Go to Home
              </button>
            )}
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden">
            <div
              className="bg-red-600 h-full rounded-full transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-slate-400 font-mono">
            <span>Direct signed storage transfer</span>
            <span>{uploadProgress}%</span>
          </div>
        </div>
      )}

      {/* Main Upload Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Dropzone */}
        {!selectedFile ? (
          <div
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-700 hover:border-red-500/60 rounded-2xl p-10 text-center cursor-pointer bg-slate-900/40 hover:bg-slate-900/80 transition group"
          >
            <input
              type="file"
              ref={fileInputRef}
              accept="video/mp4,video/quicktime,video/webm"
              onChange={(e) => handleFileSelect(e.target.files?.[0])}
              className="hidden"
            />
            <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-red-600/10 text-red-500 flex items-center justify-center group-hover:scale-105 transition">
              <FileVideo className="w-7 h-7" />
            </div>
            <p className="text-base font-semibold text-slate-200">
              Drag &amp; drop video files to upload, or{' '}
              <span className="text-red-400 underline">browse</span>
            </p>
            <p className="text-xs text-slate-400 mt-2">
              Supported formats: MP4, MOV, WebM &bull; Maximum size: {MAX_UPLOAD_MB}MB
            </p>
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-600/20 text-red-400 flex items-center justify-center">
                <Video className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-200">{selectedFile.name}</p>
                <p className="text-xs text-slate-400">
                  {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB &bull; {selectedFile.type}
                </p>
              </div>
            </div>
            {!isUploading && (
              <button
                type="button"
                onClick={() => setSelectedFile(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        )}

        {/* Metadata Inputs */}
        <div className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Title *
            </label>
            <input
              type="text"
              name="title"
              required
              maxLength={100}
              value={formData.title}
              onChange={handleInputChange}
              placeholder="e.g. Binary search trees explained in 10 minutes"
              className={`w-full px-3.5 py-2.5 bg-slate-800 border ${
                fieldErrors.title ? 'border-red-500' : 'border-slate-700'
              } rounded-lg text-slate-100 placeholder-slate-400 text-sm focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500 transition`}
            />
            {fieldErrors.title && (
              <p className="mt-1 text-xs text-red-400">{fieldErrors.title}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Description
            </label>
            <textarea
              name="description"
              rows={4}
              maxLength={5000}
              value={formData.description}
              onChange={handleInputChange}
              placeholder="Explain what viewers will learn in this lecture or demo..."
              className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-400 text-sm focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500 transition resize-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Tags (comma separated, max 10)
              </label>
              <input
                type="text"
                name="tags"
                value={formData.tags}
                onChange={handleInputChange}
                placeholder="dsa, trees, algorithms"
                className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-400 text-sm focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Visibility
              </label>
              <select
                name="visibility"
                value={formData.visibility}
                onChange={handleInputChange}
                className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500 transition cursor-pointer"
              >
                <option value="public">Public (Everyone can search &amp; watch)</option>
                <option value="unlisted">Unlisted (Anyone with link can watch)</option>
                <option value="private">Private (Only you can watch)</option>
              </select>
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={!selectedFile || isUploading}
          className="w-full py-3 px-4 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-medium text-sm rounded-xl shadow-lg shadow-red-600/30 transition flex items-center justify-center gap-2 cursor-pointer"
        >
          {isUploading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Processing Upload ({uploadProgress}%)...</span>
            </>
          ) : (
            <>
              <UploadIcon className="w-5 h-5" />
              <span>Start Upload</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
}
