require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

// Services
const PlaylistService = require('./services/PlaylistService');
const FFmpegService = require('./services/FFmpegService');
const StreamManager = require('./services/StreamManager');
const SessionManager = require('./services/SessionManager');
const StateManager = require('./services/StateManager');

// Routes
const createApiRoutes = require('./routes/api');
const createStreamRoutes = require('./routes/stream');

// Configuration
const PORT = process.env.PORT || 3000;
const PLAYLIST_URL = process.env.PLAYLIST_URL || 'https://iptv-org.github.io/iptv/index.m3u';
const HLS_OUTPUT_DIR = process.env.HLS_OUTPUT_DIR || path.join(__dirname, '..', 'tmp', 'hls');
const SESSION_TIMEOUT = parseInt(process.env.SESSION_TIMEOUT) || 30000;

// Initialize services
const playlistService = new PlaylistService(PLAYLIST_URL);
const ffmpegService = new FFmpegService(HLS_OUTPUT_DIR);
const stateManager = new StateManager(path.join(__dirname, '..', 'data'));
const streamManager = new StreamManager(ffmpegService, stateManager);
const sessionManager = new SessionManager(streamManager, SESSION_TIMEOUT, stateManager);

// Create Express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// Serve static files (frontend)
app.use(express.static(path.join(__dirname, '..', 'public')));

// API routes
app.use('/api', createApiRoutes(playlistService, streamManager, sessionManager));

// Stream routes
app.use('/stream', createStreamRoutes(streamManager, HLS_OUTPUT_DIR));

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({
        success: false,
        error: 'Internal server error'
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Not found'
    });
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');

    sessionManager.destroy();
    streamManager.destroy();

    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully');

    sessionManager.destroy();
    streamManager.destroy();

    process.exit(0);
});

// Start server
app.listen(PORT, () => {
    console.log('='.repeat(50));
    console.log('HLS IPTV On-Demand Restreamer');
    console.log('='.repeat(50));
    console.log(`Server running on port ${PORT}`);
    console.log(`Playlist URL: ${PLAYLIST_URL}`);
    console.log(`HLS Output: ${HLS_OUTPUT_DIR}`);
    console.log(`Session Timeout: ${SESSION_TIMEOUT}ms`);
    console.log('='.repeat(50));

    // Initialize state and load assets
    (async () => {
        try {
            // 1. Init Data Directory
            await stateManager.init();

            // 2. Preload Playlist & Offline Assets
            const [channels] = await Promise.all([
                playlistService.fetchPlaylist(),
                ffmpegService.generateOfflineStream()
            ]);
            console.log(`Loaded ${channels.length} channels from playlist`);

            // 3. Restore State (Streams first, then Sessions)
            // Note: restoring streams will start FFmpeg processes
            await streamManager.restoreState();
            await sessionManager.restoreState();

        } catch (error) {
            console.error('Failed to initialize:', error);
        }
    })();
});
