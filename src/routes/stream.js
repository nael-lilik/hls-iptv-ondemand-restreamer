const express = require('express');
const path = require('path');
const fs = require('fs').promises;

function createStreamRoutes(streamManager, outputDir) {
    const router = express.Router();

    // Serve HLS playlist
    router.get('/:channelId/playlist.m3u8', async (req, res) => {
        const { channelId } = req.params;
        const playlistPath = path.join(outputDir, channelId, 'playlist.m3u8');

        try {
            // Check if stream exists in manager (skip for _offline_)
            const streamStatus = streamManager.getStreamStatus(channelId);
            if (!streamStatus && channelId !== '_offline_') {
                return res.status(404).send('Stream not found');
            }

            // Polling for file existence (max 10 seconds)
            let fileReady = false;
            for (let i = 0; i < 20; i++) {
                try {
                    await fs.access(playlistPath);
                    fileReady = true;
                    break;
                } catch (e) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            }

            if (!fileReady) {
                console.warn(`Playlist not ready for ${channelId}, serving offline feed`);
                // Fallback to offline stream
                const offlinePath = path.join(outputDir, '_offline_', 'playlist.m3u8');
                let offlineContent = await fs.readFile(offlinePath, 'utf-8');

                // Rewrite segments to point to _offline_ channel
                offlineContent = offlineContent.replace(/^(.*\.ts)$/gm, '/stream/_offline_/$1');

                res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
                res.setHeader('Cache-Control', 'no-cache');
                res.setHeader('Access-Control-Allow-Origin', '*');
                return res.send(offlineContent);
            }

            let content = await fs.readFile(playlistPath, 'utf-8');

            // Cache Busting / Serialization
            // Append stream start time to segment URLs to prevent playing cached segments from previous sessions
            const streamInfo = streamManager.getStreamStatus(channelId);
            if (streamInfo) {
                const version = streamInfo.startTime;
                content = content.replace(/^(.*\.ts)$/gm, `$1?v=${version}`);
            }

            res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, proxy-revalidate, max-age=0');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.send(content);
        } catch (error) {
            console.error(`Error serving playlist for ${channelId}:`, error);
            res.status(500).send('Error reading playlist');
        }
    });

    // Serve HLS segments
    router.get('/:channelId/:segment', async (req, res) => {
        const { channelId, segment } = req.params;

        // Validate segment filename
        if (!segment.endsWith('.ts')) {
            return res.status(400).send('Invalid segment');
        }

        const segmentPath = path.join(outputDir, channelId, segment);

        try {
            const content = await fs.readFile(segmentPath);

            res.setHeader('Content-Type', 'video/mp2t');
            res.setHeader('Cache-Control', 'public, max-age=3600');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.send(content);
        } catch (error) {
            console.error(`Error serving segment ${segment} for ${channelId}:`, error);
            res.status(404).send('Segment not found');
        }
    });

    return router;
}

module.exports = createStreamRoutes;
