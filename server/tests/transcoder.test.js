const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');
const { promisify } = require('util');
const { probeVideo, transcodeToHLS } = require('../src/workers/transcoder');

const execFileAsync = promisify(execFile);
const testDir = path.join(os.tmpdir(), `transcoder_test_${Date.now()}`);
const testClipPath = path.join(testDir, 'sample_clip.mp4');
const outDir = path.join(testDir, 'out');

describe('FFmpeg HLS Transcoder Suite (Checkpoint 9)', () => {
  beforeAll(async () => {
    await fs.promises.mkdir(testDir, { recursive: true });

    // Generate a valid 4-second 720p MP4 test video with audio using ffmpeg lavfi
    const genArgs = [
      '-y',
      '-f', 'lavfi',
      '-i', 'testsrc=duration=4:size=1280x720:rate=30',
      '-f', 'lavfi',
      '-i', 'sine=frequency=1000:duration=4',
      '-c:v', 'libx264',
      '-c:a', 'aac',
      testClipPath,
    ];

    await execFileAsync('ffmpeg', genArgs);
  }, 20000);

  afterAll(async () => {
    try {
      await fs.promises.rm(testDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('probeVideo accurately parses dimensions, duration, and audio stream', async () => {
    const meta = await probeVideo(testClipPath);

    expect(meta.width).toBe(1280);
    expect(meta.height).toBe(720);
    expect(meta.durationSec).toBeGreaterThanOrEqual(3.9);
    expect(meta.hasAudio).toBe(true);
    expect(meta.videoCodec).toBe('h264');
  });

  it('probeVideo rejects corrupt or non-media files', async () => {
    const fakeFile = path.join(testDir, 'fake_video.mp4');
    await fs.promises.writeFile(fakeFile, 'This is plain text, not a video');

    await expect(probeVideo(fakeFile)).rejects.toThrow(/unreadable container|corrupt media/i);
  });

  it('Worker on one clip produces valid HLS: ffprobe out/360p/index.m3u8 exits 0 and segments exist', async () => {
    const meta = await probeVideo(testClipPath);
    await transcodeToHLS(testClipPath, outDir, meta);

    const p360Playlist = path.join(outDir, '360p', 'index.m3u8');
    expect(fs.existsSync(p360Playlist)).toBe(true);

    // Run ffprobe on the generated HLS playlist to confirm it exits 0
    const probeRes = await execFileAsync('ffprobe', ['-v', 'error', p360Playlist]);
    expect(probeRes.stderr).toBe('');

    // Verify TS segments exist
    const p360Files = await fs.promises.readdir(path.join(outDir, '360p'));
    const tsSegments = p360Files.filter((f) => f.endsWith('.ts'));
    expect(tsSegments.length).toBeGreaterThan(0);

    // Verify 720p rendition exists since source is 720p
    const p720Playlist = path.join(outDir, '720p', 'index.m3u8');
    expect(fs.existsSync(p720Playlist)).toBe(true);

    // Verify master.m3u8 exists and references both renditions
    const masterPath = path.join(outDir, 'master.m3u8');
    expect(fs.existsSync(masterPath)).toBe(true);
    const masterContent = await fs.promises.readFile(masterPath, 'utf-8');
    expect(masterContent).toContain('360p/index.m3u8');
    expect(masterContent).toContain('720p/index.m3u8');

    // Verify thumbnail exists
    const thumbPath = path.join(outDir, 'thumb.jpg');
    expect(fs.existsSync(thumbPath)).toBe(true);
    const thumbStats = await fs.promises.stat(thumbPath);
    expect(thumbStats.size).toBeGreaterThan(100);
  }, 25000);
});
