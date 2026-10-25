const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

/**
 * Probe a video file using ffprobe.
 * Extracts video/audio streams, duration, dimensions, and validates file container.
 */
async function probeVideo(inputPath) {
  const args = [
    '-v', 'error',
    '-print_format', 'json',
    '-show_format',
    '-show_streams',
    inputPath,
  ];

  let stdout;
  try {
    const res = await execFileAsync('ffprobe', args);
    stdout = res.stdout;
  } catch (err) {
    throw new Error(`Failed to probe video file: unreadable container or corrupt media (${err.message})`);
  }

  let probeData;
  try {
    probeData = JSON.parse(stdout);
  } catch {
    throw new Error('Could not parse ffprobe output');
  }

  const streams = probeData.streams || [];
  const format = probeData.format || {};

  const videoStream = streams.find((s) => s.codec_type === 'video');
  if (!videoStream) {
    throw new Error('Invalid media file: no video stream found');
  }

  const audioStream = streams.find((s) => s.codec_type === 'audio');
  const hasAudio = !!audioStream;

  const width = parseInt(videoStream.width, 10) || 0;
  const height = parseInt(videoStream.height, 10) || 0;

  let durationSec = parseFloat(videoStream.duration || format.duration || 0);
  if (isNaN(durationSec) || durationSec <= 0) {
    durationSec = 1; // Fallback for very short clips
  }

  const maxDuration = parseInt(process.env.MAX_DURATION_SEC, 10) || 1200;
  if (durationSec > maxDuration) {
    throw new Error(`Video duration (${Math.round(durationSec)}s) exceeds limit of ${maxDuration}s`);
  }

  return {
    width,
    height,
    durationSec,
    hasAudio,
    formatName: format.format_name,
    videoCodec: videoStream.codec_name,
  };
}

/**
 * Transcode video to multi-rendition HLS (360p always, 720p if height >= 720) and extract thumbnail.
 */
async function transcodeToHLS(inputPath, outputDir, metadata) {
  await fs.promises.mkdir(outputDir, { recursive: true });

  const renditions = [];
  const p360Dir = path.join(outputDir, '360p');
  await fs.promises.mkdir(p360Dir, { recursive: true });

  // 1. 360p Rendition (always produced)
  const args360 = [
    '-y',
    '-i', inputPath,
    '-vf', 'scale=-2:360',
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-crf', '23',
    ...(metadata.hasAudio ? ['-c:a', 'aac', '-b:a', '96k'] : ['-an']),
    '-f', 'hls',
    '-hls_time', '6',
    '-hls_playlist_type', 'vod',
    '-hls_segment_filename', path.join(p360Dir, 'seg_%03d.ts'),
    path.join(p360Dir, 'index.m3u8'),
  ];

  await execFileAsync('ffmpeg', args360);
  renditions.push({
    name: '360p',
    bandwidth: 900000,
    width: Math.round(((metadata.width / (metadata.height || 360)) * 360) / 2) * 2 || 640,
    height: 360,
    playlist: '360p/index.m3u8',
  });

  // 2. 720p Rendition (only when source is at least 720 pixels tall)
  if (metadata.height >= 720) {
    const p720Dir = path.join(outputDir, '720p');
    await fs.promises.mkdir(p720Dir, { recursive: true });

    const args720 = [
      '-y',
      '-i', inputPath,
      '-vf', 'scale=-2:720',
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-crf', '23',
      ...(metadata.hasAudio ? ['-c:a', 'aac', '-b:a', '128k'] : ['-an']),
      '-f', 'hls',
      '-hls_time', '6',
      '-hls_playlist_type', 'vod',
      '-hls_segment_filename', path.join(p720Dir, 'seg_%03d.ts'),
      path.join(p720Dir, 'index.m3u8'),
    ];

    await execFileAsync('ffmpeg', args720);
    renditions.push({
      name: '720p',
      bandwidth: 2800000,
      width: Math.round(((metadata.width / (metadata.height || 720)) * 720) / 2) * 2 || 1280,
      height: 720,
      playlist: '720p/index.m3u8',
    });
  }

  // 3. Extract thumbnail at 10% of duration
  const thumbTime = Math.max(0.1, Math.round(metadata.durationSec * 0.1 * 100) / 100);
  const thumbPath = path.join(outputDir, 'thumb.jpg');

  const thumbArgs = [
    '-y',
    '-ss', thumbTime.toString(),
    '-i', inputPath,
    '-frames:v', '1',
    '-vf', 'scale=640:-2',
    thumbPath,
  ];

  await execFileAsync('ffmpeg', thumbArgs);

  // 4. Generate Master Playlist (master.m3u8)
  let masterContent = '#EXTM3U\n';
  for (const r of renditions) {
    masterContent += `#EXT-X-STREAM-INF:BANDWIDTH=${r.bandwidth},RESOLUTION=${r.width}x${r.height}\n`;
    masterContent += `${r.playlist}\n`;
  }

  const masterPath = path.join(outputDir, 'master.m3u8');
  await fs.promises.writeFile(masterPath, masterContent, 'utf-8');

  return {
    outputDir,
    masterPath,
    thumbPath,
    renditions,
  };
}

module.exports = {
  probeVideo,
  transcodeToHLS,
};
