const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;

class FFmpegService {
    constructor(outputDir) {
        this.outputDir = outputDir;
    }

    async ensureOutputDir(channelId) {
        const channelDir = path.join(this.outputDir, channelId);
        try {
            await fs.mkdir(channelDir, { recursive: true });
        } catch (error) {
            console.error(`Error creating directory for ${channelId}:`, error);
        }
        return channelDir;
    }

    async startTranscoding(channelId, sourceUrl, options = {}) {
        const channelDir = await this.ensureOutputDir(channelId);
        const playlistPath = path.join(channelDir, 'playlist.m3u8');
        const segmentPattern = path.join(channelDir, 'segment_%03d.ts');

        const {
            preset = process.env.FFMPEG_PRESET || 'ultrafast',
            videoCodec = process.env.FFMPEG_VIDEO_CODEC || 'libx264',
            audioCodec = process.env.FFMPEG_AUDIO_CODEC || 'aac',
            audioBitrate = process.env.FFMPEG_AUDIO_BITRATE || '128k',
            fps = process.env.FFMPEG_FPS || null,
            resolution = process.env.FFMPEG_RESOLUTION || null,
            segmentDuration = process.env.HLS_SEGMENT_DURATION || '6',
            listSize = process.env.HLS_LIST_SIZE || '10'
        } = options;

        const args = [
            '-analyzeduration', '10000000', // Increased to 10s for stability
            '-probesize', '10000000', // Increased to 10MB for stability
            '-i', sourceUrl,
            '-c:v', videoCodec,
            '-preset', preset,
            '-tune', 'zerolatency'
        ];

        // Add Video Filters (Scaling & FPS) with no-upscale protection
        const videoFilters = [];
        if (resolution) {
            const targetWidth = (resolution.includes(':') ? resolution.split(':')[0] : (resolution.includes('x') ? resolution.split('x')[0] : resolution)).trim();
            // Only downscale if input width (iw) is larger than targetWidth. -2 maintains aspect ratio and even dimensions.
            if (!isNaN(targetWidth)) {
                videoFilters.push(`scale=min(${targetWidth}\\,iw):-2`);
            } else {
                videoFilters.push(`scale=${resolution}`);
            }
        }
        if (fps) {
            videoFilters.push(`fps=${fps}`);
        }

        if (videoFilters.length > 0) {
            args.push('-vf', videoFilters.join(','));
        }

        args.push(
            '-c:a', audioCodec,
            '-b:a', audioBitrate,
            '-copyts', // Help with stream stability
            '-f', 'hls',
            '-hls_time', segmentDuration,
            '-hls_list_size', listSize,
            '-hls_flags', 'delete_segments+append_list',
            '-hls_segment_filename', segmentPattern,
            '-loglevel', 'warning',
            '-stats',
            playlistPath
        );

        console.log(`Starting FFmpeg for channel ${channelId}`);
        console.log(`Command: ffmpeg ${args.join(' ')}`);

        const ffmpegProcess = spawn('ffmpeg', args, {
            stdio: ['ignore', 'pipe', 'pipe']
        });

        // Track process state
        ffmpegProcess.isExited = false;
        ffmpegProcess.on('exit', () => { ffmpegProcess.isExited = true; });

        // Log FFmpeg output
        ffmpegProcess.stdout.on('data', (data) => {
            console.log(`[FFmpeg ${channelId}] ${data.toString().trim()}`);
        });

        ffmpegProcess.stderr.on('data', (data) => {
            const message = data.toString().trim();
            if (message && !message.includes('frame=')) {
                console.log(`[FFmpeg ${channelId}] ${message}`);
            }
        });

        ffmpegProcess.on('error', (error) => {
            console.error(`[FFmpeg ${channelId}] Process error:`, error);
        });

        ffmpegProcess.on('exit', (code, signal) => {
            console.log(`[FFmpeg ${channelId}] Process exited with code ${code}, signal ${signal}`);
        });

        return {
            process: ffmpegProcess,
            playlistPath,
            channelDir
        };
    }

    async stopTranscoding(ffmpegProcess) {
        if (!ffmpegProcess || ffmpegProcess.isExited) return true;

        return new Promise((resolve) => {
            const killTimeout = setTimeout(() => {
                if (!ffmpegProcess.isExited) {
                    console.log('Force killing FFmpeg process after timeout');
                    ffmpegProcess.kill('SIGKILL');
                }
                resolve(true);
            }, 5000);

            ffmpegProcess.once('exit', () => {
                clearTimeout(killTimeout);
                resolve(true);
            });

            console.log('Sending SIGTERM to FFmpeg process');
            ffmpegProcess.kill('SIGTERM');
        });
    }

    async cleanupChannelDir(channelId) {
        const channelDir = path.join(this.outputDir, channelId);
        try {
            await fs.rm(channelDir, { recursive: true, force: true });
            console.log(`Cleaned up directory for channel ${channelId}`);
        } catch (error) {
            console.error(`Error cleaning up directory for ${channelId}:`, error);
        }
    }

    async getPlaylistContent(channelId) {
        const playlistPath = path.join(this.outputDir, channelId, 'playlist.m3u8');
        try {
            return await fs.readFile(playlistPath, 'utf-8');
        } catch (error) {
            return null;
        }
    }
}

module.exports = FFmpegService;
