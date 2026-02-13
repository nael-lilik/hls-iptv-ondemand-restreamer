class SessionManager {
    constructor(streamManager, sessionTimeout = 30000) {
        this.streamManager = streamManager;
        this.sessionTimeout = sessionTimeout;
        this.sessions = new Map(); // sessionId -> { channelId, lastHeartbeat }

        // Start cleanup interval
        this.cleanupInterval = setInterval(() => {
            this.cleanupStaleSessions();
        }, 10000); // Check every 10 seconds
    }

    createSession(sessionId, channelId) {
        this.sessions.set(sessionId, {
            channelId,
            lastHeartbeat: Date.now()
        });

        console.log(`Session created: ${sessionId} for channel ${channelId}`);
        return true;
    }

    updateHeartbeat(sessionId) {
        const session = this.sessions.get(sessionId);
        if (session) {
            session.lastHeartbeat = Date.now();
            return true;
        }
        return false;
    }

    removeSession(sessionId) {
        const session = this.sessions.get(sessionId);
        if (session) {
            const { channelId } = session;
            this.sessions.delete(sessionId);

            console.log(`Session removed: ${sessionId}`);

            // Notify stream manager to remove viewer
            this.streamManager.removeViewer(channelId, sessionId);
            return true;
        }
        return false;
    }

    getSession(sessionId) {
        return this.sessions.get(sessionId);
    }

    getSessionsByChannel(channelId) {
        const sessions = [];
        for (const [sessionId, session] of this.sessions.entries()) {
            if (session.channelId === channelId) {
                sessions.push({ sessionId, ...session });
            }
        }
        return sessions;
    }

    cleanupStaleSessions() {
        const now = Date.now();
        const staleSessionIds = [];

        for (const [sessionId, session] of this.sessions.entries()) {
            if (now - session.lastHeartbeat > this.sessionTimeout) {
                staleSessionIds.push(sessionId);
            }
        }

        if (staleSessionIds.length > 0) {
            console.log(`Cleaning up ${staleSessionIds.length} stale sessions`);
            staleSessionIds.forEach(sessionId => this.removeSession(sessionId));
        }
    }

    getStats() {
        const channelViewers = new Map();

        for (const session of this.sessions.values()) {
            const count = channelViewers.get(session.channelId) || 0;
            channelViewers.set(session.channelId, count + 1);
        }

        return {
            totalSessions: this.sessions.size,
            channelViewers: Object.fromEntries(channelViewers)
        };
    }

    destroy() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        this.sessions.clear();
    }
}

module.exports = SessionManager;
