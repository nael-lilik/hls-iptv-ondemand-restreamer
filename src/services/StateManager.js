const fs = require('fs').promises;
const path = require('path');

class StateManager {
    constructor(dataDir) {
        this.dataDir = dataDir;
        this.streamsFile = path.join(dataDir, 'streams.json');
        this.sessionsFile = path.join(dataDir, 'sessions.json');
    }

    async init() {
        try {
            await fs.mkdir(this.dataDir, { recursive: true });
        } catch (error) {
            console.error('Error creating data directory:', error);
        }
    }

    async saveStreams(streams) {
        try {
            await fs.writeFile(this.streamsFile, JSON.stringify(streams, null, 2));
        } catch (error) {
            console.error('Error saving streams state:', error);
        }
    }

    async loadStreams() {
        try {
            const data = await fs.readFile(this.streamsFile, 'utf-8');
            return JSON.parse(data);
        } catch (error) {
            if (error.code !== 'ENOENT') {
                console.error('Error loading streams state:', error);
            }
            return [];
        }
    }

    async saveSessions(sessions) {
        try {
            await fs.writeFile(this.sessionsFile, JSON.stringify(sessions, null, 2));
        } catch (error) {
            console.error('Error saving sessions state:', error);
        }
    }

    async loadSessions() {
        try {
            const data = await fs.readFile(this.sessionsFile, 'utf-8');
            return JSON.parse(data);
        } catch (error) {
            if (error.code !== 'ENOENT') {
                console.error('Error loading sessions state:', error);
            }
            return [];
        }
    }
}

module.exports = StateManager;
