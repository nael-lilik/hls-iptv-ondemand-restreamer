const express = require('express');
const { v4: uuidv4 } = require('uuid');

function createApiRoutes(playlistService, streamManager, sessionManager) {
    const router = express.Router();

    // Health check
    router.get('/health', (req, res) => {
        res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    // Get all channels
    router.get('/channels', async (req, res) => {
        try {
            const channels = await playlistService.getChannels();
            res.json({
                success: true,
                count: channels.length,
                channels
            });
        } catch (error) {
            console.error('Error fetching channels:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch channels'
            });
        }
    });

    // Search channels
    router.get('/channels/search', async (req, res) => {
        try {
            const { q } = req.query;
            if (!q) {
                return res.status(400).json({
                    success: false,
                    error: 'Query parameter "q" is required'
                });
            }

            const channels = await playlistService.searchChannels(q);
            res.json({
                success: true,
                count: channels.length,
                query: q,
                channels
            });
        } catch (error) {
            console.error('Error searching channels:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to search channels'
            });
        }
    });

    // Get channel groups
    router.get('/groups', async (req, res) => {
        try {
            const groups = await playlistService.getGroups();
            res.json({
                success: true,
                count: groups.length,
                groups
            });
        } catch (error) {
            console.error('Error fetching groups:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch groups'
            });
        }
    });

    // Get channels by group
    router.get('/groups/:group/channels', async (req, res) => {
        try {
            const { group } = req.params;
            const channels = await playlistService.getChannelsByGroup(decodeURIComponent(group));
            res.json({
                success: true,
                group,
                count: channels.length,
                channels
            });
        } catch (error) {
            console.error('Error fetching channels by group:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch channels'
            });
        }
    });

    // Start streaming a channel
    router.post('/channels/:id/start', async (req, res) => {
        try {
            const { id } = req.params;
            const channel = await playlistService.getChannelById(id);

            if (!channel) {
                return res.status(404).json({
                    success: false,
                    error: 'Channel not found'
                });
            }

            // Check if stream already running
            let streamStatus = streamManager.getStreamStatus(id);

            if (!streamStatus) {
                // Start new stream
                const result = await streamManager.startStream(id, channel.url);
                streamStatus = streamManager.getStreamStatus(id);
            }

            // Create session
            const sessionId = uuidv4();
            sessionManager.createSession(sessionId, id);
            streamManager.addViewer(id, sessionId);

            res.json({
                success: true,
                sessionId,
                channel: {
                    id: channel.id,
                    name: channel.name,
                    logo: channel.logo,
                    group: channel.group
                },
                stream: streamStatus,
                playlistUrl: `/stream/${id}/playlist.m3u8`
            });
        } catch (error) {
            console.error('Error starting channel:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to start channel stream'
            });
        }
    });

    // Session heartbeat
    router.post('/sessions/:sessionId/heartbeat', (req, res) => {
        const { sessionId } = req.params;
        const updated = sessionManager.updateHeartbeat(sessionId);

        if (updated) {
            res.json({
                success: true,
                sessionId,
                timestamp: Date.now()
            });
        } else {
            res.status(404).json({
                success: false,
                error: 'Session not found'
            });
        }
    });

    // End session
    router.delete('/sessions/:sessionId', (req, res) => {
        const { sessionId } = req.params;
        const removed = sessionManager.removeSession(sessionId);

        if (removed) {
            res.json({
                success: true,
                message: 'Session ended'
            });
        } else {
            res.status(404).json({
                success: false,
                error: 'Session not found'
            });
        }
    });

    // Get system stats
    router.get('/stats', (req, res) => {
        const streamStats = streamManager.getStats();
        const sessionStats = sessionManager.getStats();

        res.json({
            success: true,
            stats: {
                streams: streamStats,
                sessions: sessionStats,
                timestamp: new Date().toISOString()
            }
        });
    });

    // Get stream status
    router.get('/streams/:channelId/status', (req, res) => {
        const { channelId } = req.params;
        const status = streamManager.getStreamStatus(channelId);

        if (status) {
            res.json({
                success: true,
                status
            });
        } else {
            res.status(404).json({
                success: false,
                error: 'Stream not found'
            });
        }
    });

    return router;
}

module.exports = createApiRoutes;
