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
            segmentDuration = process.env.HLS_SEGMENT_DURATION || '6',
            listSize = process.env.HLS_LIST_SIZE || '10'
        } = options;

        const args = [
            '-re', // Read input at native frame rate
            '-analyzeduration', '1000000', // Limit analysis duration to 1s
            '-probesize', '1000000', // Limit probe size to 1MB
            '-i', sourceUrl,
            '-c:v', videoCodec,
            '-preset', preset,
            '-tune', 'zerolatency'
        ];

        // Add FPS restriction if specified
        if (fps) {
            args.push('-r', fps);
        }

        args.push(
            '-c:a', audioCodec,
            '-b:a', audioBitrate,
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

        // Log FFmpeg output
        ffmpegProcess.stdout.on('data', (data) => {
            console.log(`[FFmpeg ${channelId}] ${data.toString().trim()}`);
        });

        ffmpegProcess.stderr.on('data', (data) => {
            const message = data.toString().trim();
            if (message) {
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

    stopTranscoding(ffmpegProcess) {
        if (ffmpegProcess && !ffmpegProcess.killed) {
            console.log('Stopping FFmpeg process');
            ffmpegProcess.kill('SIGTERM');

            // Force kill if not stopped after 5 seconds
            setTimeout(() => {
                if (!ffmpegProcess.killed) {
                    console.log('Force killing FFmpeg process');
                    ffmpegProcess.kill('SIGKILL');
                }
            }, 5000);

            return true;
        }
        return false;
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
