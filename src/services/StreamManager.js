const FFmpegService = require('./FFmpegService');

class StreamManager {
    constructor(ffmpegService, stateManager) {
        this.ffmpegService = ffmpegService;
        this.stateManager = stateManager;
        this.streams = new Map(); // channelId -> { process, viewers: Set, startTime, status, sourceUrl }

        // Start periodic cleanup
        this.cleanupInterval = setInterval(() => {
            this.cleanupStaleStreams();
        }, parseInt(process.env.CLEANUP_INTERVAL) || 60000);
    }

    async restoreState() {
        if (!this.stateManager) return;

        const savedStreams = await this.stateManager.loadStreams();
        console.log(`Restoring ${savedStreams.length} streams from state...`);

        for (const s of savedStreams) {
            try {
                // Determine source URL (might need to fetch from playlist service normally, but here we saved it)
                // If sourceUrl is not saved, we might skip or re-fetch playlist. 
                // For simplicity, we assume we saved sourceUrl.
                if (s.channelId && s.sourceUrl) {
                    console.log(`Restoring stream: ${s.channelId}`);
                    await this.startStream(s.channelId, s.sourceUrl);
                }
            } catch (err) {
                console.error(`Failed to restore stream ${s.channelId}:`, err);
            }
        }
    }

    async saveState() {
        if (!this.stateManager) return;

        const streamsToSave = [];
        for (const [channelId, stream] of this.streams.entries()) {
            if (stream.status === 'running' || stream.status === 'starting') {
                streamsToSave.push({
                    channelId,
                    sourceUrl: stream.sourceUrl
                });
            }
        }
        await this.stateManager.saveStreams(streamsToSave);
    }

    async startStream(channelId, sourceUrl) {
        // Check if stream already exists
        if (this.streams.has(channelId)) {
            const stream = this.streams.get(channelId);
            if (stream.status === 'running') {
                console.log(`Stream already running for channel ${channelId}`);
                return { alreadyRunning: true, stream };
            }
        }

        try {
            console.log(`Starting new stream for channel ${channelId}`);

            const { process, playlistPath, channelDir } = await this.ffmpegService.startTranscoding(
                channelId,
                sourceUrl
            );

            const streamInfo = {
                process,
                playlistPath,
                channelDir,
                viewers: new Set(),
                startTime: Date.now(),
                status: 'starting',
                sourceUrl
            };

            this.streams.set(channelId, streamInfo);
            this.saveState(); // Save state

            // Update status to running after a short delay
            setTimeout(() => {
                if (this.streams.has(channelId)) {
                    this.streams.get(channelId).status = 'running';
                }
            }, 3000);

            // Handle process exit
            process.on('exit', (code) => {
                console.log(`Stream process exited for channel ${channelId} with code ${code}`);
                if (this.streams.has(channelId)) {
                    const stream = this.streams.get(channelId);
                    stream.status = 'stopped';
                    this.saveState(); // Update state on exit

                    // Auto-restart if there are still viewers and exit was unexpected
                    if (stream.viewers.size > 0 && code !== 0) {
                        console.log(`Attempting to restart stream for channel ${channelId}`);
                        setTimeout(() => {
                            if (this.streams.has(channelId) && this.streams.get(channelId).viewers.size > 0) {
                                this.startStream(channelId, sourceUrl);
                            }
                        }, 5000);
                    }
                }
            });

            return { started: true, stream: streamInfo };
        } catch (error) {
            console.error(`Error starting stream for channel ${channelId}:`, error);
            throw error;
        }
    }

    addViewer(channelId, sessionId) {
        const stream = this.streams.get(channelId);
        if (stream) {
            stream.viewers.add(sessionId);
            console.log(`Viewer ${sessionId} added to channel ${channelId}. Total viewers: ${stream.viewers.size}`);
            return true;
        }
        return false;
    }

    removeViewer(channelId, sessionId) {
        const stream = this.streams.get(channelId);
        if (stream) {
            stream.viewers.delete(sessionId);
            console.log(`Viewer ${sessionId} removed from channel ${channelId}. Remaining viewers: ${stream.viewers.size}`);

            // Stop stream if no viewers left
            if (stream.viewers.size === 0) {
                console.log(`No viewers left for channel ${channelId}, scheduling cleanup`);
                // Wait a bit before stopping in case viewer reconnects
                setTimeout(() => {
                    if (this.streams.has(channelId) && this.streams.get(channelId).viewers.size === 0) {
                        this.stopStream(channelId);
                    }
                }, 10000); // 10 second grace period
            }

            return true;
        }
        return false;
    }

    async stopStream(channelId) {
        const stream = this.streams.get(channelId);
        if (stream) {
            console.log(`Stopping stream for channel ${channelId}`);

            // Stop FFmpeg process and wait for it to exit
            await this.ffmpegService.stopTranscoding(stream.process);

            // Cleanup files after process is gone
            await this.ffmpegService.cleanupChannelDir(channelId);

            // Remove from active streams
            this.streams.delete(channelId);
            this.saveState(); // Save state

            return true;
        }
        return false;
    }

    getStreamStatus(channelId) {
        const stream = this.streams.get(channelId);
        if (stream) {
            return {
                channelId,
                status: stream.status,
                viewers: stream.viewers.size,
                startTime: stream.startTime,
                uptime: Date.now() - stream.startTime,
                playlistPath: stream.playlistPath,
                sourceUrl: stream.sourceUrl
            };
        }
        return null;
    }

    getAllStreams() {
        const streams = [];
        for (const [channelId, stream] of this.streams.entries()) {
            streams.push({
                channelId,
                status: stream.status,
                viewers: stream.viewers.size,
                startTime: stream.startTime,
                uptime: Date.now() - stream.startTime
            });
        }
        return streams;
    }

    cleanupStaleStreams() {
        const now = Date.now();
        const maxIdleTime = 300000; // 5 minutes

        for (const [channelId, stream] of this.streams.entries()) {
            // Remove streams with no viewers that have been idle
            if (stream.viewers.size === 0 && (now - stream.startTime) > maxIdleTime) {
                console.log(`Cleaning up stale stream for channel ${channelId}`);
                this.stopStream(channelId);
            }
        }
    }

    getStats() {
        return {
            activeStreams: this.streams.size,
            totalViewers: Array.from(this.streams.values()).reduce((sum, s) => sum + s.viewers.size, 0),
            streams: this.getAllStreams()
        };
    }

    destroy() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }

        // Stop all streams
        for (const channelId of this.streams.keys()) {
            this.stopStream(channelId);
        }
    }
}

module.exports = StreamManager;
