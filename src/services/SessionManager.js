class SessionManager {
    constructor(streamManager, sessionTimeout = 30000, stateManager) {
        this.streamManager = streamManager;
        this.sessionTimeout = sessionTimeout;
        this.stateManager = stateManager;
        this.sessions = new Map(); // sessionId -> { channelId, lastHeartbeat }

        // Start cleanup interval
        this.cleanupInterval = setInterval(() => {
            this.cleanupStaleSessions();
        }, 10000); // Check every 10 seconds
    }

    async restoreState() {
        if (!this.stateManager) return;

        const savedSessions = await this.stateManager.loadSessions();
        console.log(`Restoring ${savedSessions.length} sessions from state...`);

        for (const s of savedSessions) {
            this.sessions.set(s.sessionId, {
                channelId: s.channelId,
                lastHeartbeat: Date.now() // Reset heartbeat on restore to give grace buffer
            });
            // Re-add to stream manager viewer count
            this.streamManager.addViewer(s.channelId, s.sessionId);
        }
    }

    async saveState() {
        if (!this.stateManager) return;

        const sessionsToSave = [];
        for (const [sessionId, session] of this.sessions.entries()) {
            sessionsToSave.push({
                sessionId,
                channelId: session.channelId,
                // We don't save lastHeartbeat to avoid immediate timeout on restore
            });
        }
        await this.stateManager.saveSessions(sessionsToSave);
    }

    createSession(sessionId, channelId) {
        this.sessions.set(sessionId, {
            channelId,
            lastHeartbeat: Date.now()
        });

        console.log(`Session created: ${sessionId} for channel ${channelId}`);
        this.saveState();
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
            this.saveState();
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
