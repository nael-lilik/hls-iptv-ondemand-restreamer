// Application state
const state = {
    channels: [],
    filteredChannels: [],
    currentPage: 1,
    pageSize: 50,
    currentSession: null,
    currentChannel: null,
    stats: { activeStreams: 0, totalViewers: 0 }
};

// API base URL
const API_BASE = window.location.origin;

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Initializing IPTV Restreamer...');

    // Setup event listeners
    setupEventListeners();

    // Load channels
    await loadChannels();

    // Load groups for filter
    await loadGroups();

    // Start stats polling
    startStatsPolling();
});

// Setup event listeners
function setupEventListeners() {
    const searchInput = document.getElementById('searchInput');
    const groupFilter = document.getElementById('groupFilter');
    const closePlayer = document.getElementById('closePlayer');

    searchInput.addEventListener('input', debounce(handleSearch, 300));
    groupFilter.addEventListener('change', handleGroupFilter);
    closePlayer.addEventListener('click', stopPlayback);
}

// Load channels from API
async function loadChannels() {
    try {
        const response = await fetch(`${API_BASE}/api/channels`);
        const data = await response.json();

        if (data.success) {
            state.channels = data.channels;
            state.filteredChannels = data.channels;
            renderChannels(state.filteredChannels);
            console.log(`Loaded ${data.channels.length} channels`);
        }
    } catch (error) {
        console.error('Error loading channels:', error);
        showError('Gagal memuat daftar channel');
    }
}

// Load groups for filter
async function loadGroups() {
    try {
        const response = await fetch(`${API_BASE}/api/groups`);
        const data = await response.json();

        if (data.success) {
            const groupFilter = document.getElementById('groupFilter');
            data.groups.forEach(group => {
                const option = document.createElement('option');
                option.value = group;
                option.textContent = group;
                groupFilter.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error loading groups:', error);
    }
}

// Render channels to grid (with infinite scroll)
function renderChannels(channels, append = false) {
    const grid = document.getElementById('channelGrid');
    const emptyState = document.getElementById('emptyState');

    if (channels.length === 0) {
        grid.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }

    emptyState.style.display = 'none';

    // Calculate start and end indices for pagination
    const start = (state.currentPage - 1) * state.pageSize;
    const end = state.currentPage * state.pageSize;
    const chunk = channels.slice(start, end);

    if (chunk.length === 0 && !append) {
        grid.innerHTML = '';
        return;
    }

    const html = chunk.map(channel => `
    <div class="channel-card" data-channel-id="${channel.id}">
      ${channel.logo ? `<img src="${channel.logo}" alt="${channel.name}" class="channel-logo" loading="lazy" onerror="this.style.display='none'">` : ''}
      <h3 class="channel-name">${escapeHtml(channel.name)}</h3>
      ${channel.group ? `<span class="channel-group">${escapeHtml(channel.group)}</span>` : ''}
    </div>
  `).join('');

    if (append) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        while (tempDiv.firstChild) {
            const card = tempDiv.firstChild;
            grid.appendChild(card);
            addCardClickListener(card, channels);
        }
    } else {
        grid.innerHTML = html;
        grid.querySelectorAll('.channel-card').forEach(card => {
            addCardClickListener(card, channels);
        });
    }

    // Manage intersection observer for infinite scroll
    setupInfiniteScrollTrigger(channels);
}

function addCardClickListener(card, channels) {
    card.addEventListener('click', () => {
        const channelId = card.dataset.channelId;
        const channel = channels.find(c => c.id === channelId);
        if (channel) {
            playChannel(channel);
        }
    });
}

let scrollObserver = null;
function setupInfiniteScrollTrigger(channels) {
    // Remove existing observer/trigger
    const existingTrigger = document.getElementById('infiniteScrollTrigger');
    if (existingTrigger) existingTrigger.remove();
    if (scrollObserver) scrollObserver.disconnect();

    // If we've reached the end, don't add a trigger
    if (state.currentPage * state.pageSize >= channels.length) return;

    // Add a marker element at the end of the grid
    const trigger = document.createElement('div');
    trigger.id = 'infiniteScrollTrigger';
    trigger.style.height = '20px';
    trigger.style.width = '100%';
    document.getElementById('channelGrid').after(trigger);

    scrollObserver = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) {
            state.currentPage++;
            renderChannels(channels, true);
        }
    }, { rootMargin: '200px' });

    scrollObserver.observe(trigger);
}

// Handle search
function handleSearch(event) {
    const query = event.target.value.toLowerCase().trim();

    if (!query) {
        state.filteredChannels = state.channels;
    } else {
        state.filteredChannels = state.channels.filter(channel =>
            channel.name.toLowerCase().includes(query) ||
            (channel.group && channel.group.toLowerCase().includes(query))
        );
    }

    state.currentPage = 1;
    renderChannels(state.filteredChannels);
}

// Handle group filter
function handleGroupFilter(event) {
    const group = event.target.value;

    if (!group) {
        state.filteredChannels = state.channels;
    } else {
        state.filteredChannels = state.channels.filter(channel => channel.group === group);
    }

    state.currentPage = 1;
    renderChannels(state.filteredChannels);

    // Reset search
    document.getElementById('searchInput').value = '';
}

// Play channel
async function playChannel(channel) {
    console.log('Playing channel:', channel.name);

    // Show player container
    const playerContainer = document.getElementById('playerContainer');
    const playerLoading = document.getElementById('playerLoading');
    const playerError = document.getElementById('playerError');

    playerContainer.style.display = 'block';
    playerLoading.style.display = 'block';
    playerError.style.display = 'none';

    // Update player info
    document.getElementById('playerTitle').textContent = channel.name;
    document.getElementById('playerGroup').textContent = channel.group || 'Uncategorized';

    // Scroll to player
    playerContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });

    try {
        // Start stream
        const response = await fetch(`${API_BASE}/api/channels/${channel.id}/start`, {
            method: 'POST'
        });

        const data = await response.json();

        if (data.success) {
            state.currentSession = data.sessionId;
            state.currentChannel = channel;

            // Initialize player
            window.initPlayer(data.playlistUrl);

            // Start heartbeat
            startHeartbeat();
        } else {
            throw new Error(data.error || 'Failed to start stream');
        }
    } catch (error) {
        console.error('Error playing channel:', error);
        playerLoading.style.display = 'none';
        playerError.style.display = 'block';
    }
}

// Stop playback
function stopPlayback() {
    console.log('Stopping playback');

    // Stop heartbeat
    stopHeartbeat();

    // End session
    if (state.currentSession) {
        fetch(`${API_BASE}/api/sessions/${state.currentSession}`, {
            method: 'DELETE'
        }).catch(err => console.error('Error ending session:', err));
    }

    // Stop player
    if (window.stopPlayer) {
        window.stopPlayer();
    }

    // Hide player
    document.getElementById('playerContainer').style.display = 'none';

    // Reset state
    state.currentSession = null;
    state.currentChannel = null;
}

// Heartbeat mechanism
let heartbeatInterval = null;

function startHeartbeat() {
    stopHeartbeat();

    heartbeatInterval = setInterval(async () => {
        if (!state.currentSession) {
            stopHeartbeat();
            return;
        }

        try {
            await fetch(`${API_BASE}/api/sessions/${state.currentSession}/heartbeat`, {
                method: 'POST'
            });
        } catch (error) {
            console.error('Heartbeat error:', error);
        }
    }, 10000); // Every 10 seconds
}

function stopHeartbeat() {
    if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
    }
}

// Stats polling
function startStatsPolling() {
    updateStats();
    setInterval(updateStats, 15000); // Every 15 seconds
}

async function updateStats() {
    try {
        const response = await fetch(`${API_BASE}/api/stats`);
        const data = await response.json();

        if (data.success) {
            state.stats = data.stats.streams;

            // Update UI
            document.getElementById('viewerCount').textContent = state.stats.totalViewers;
            document.getElementById('activeStreams').textContent = `${state.stats.activeStreams} stream aktif`;
            document.getElementById('totalViewers').textContent = `${state.stats.totalViewers} viewers`;

            // Update player viewer count if watching
            if (state.currentChannel) {
                const channelStream = state.stats.streams.find(s => s.channelId === state.currentChannel.id);
                if (channelStream) {
                    document.getElementById('viewerCountPlayer').textContent = channelStream.viewers;
                }
            }
        }
    } catch (error) {
        console.error('Error fetching stats:', error);
    }
}

// Utility functions
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showError(message) {
    console.error(message);
    // Could implement a toast notification here
}

// Handle page visibility for heartbeat
document.addEventListener('visibilitychange', () => {
    if (document.hidden && state.currentSession) {
        // Page hidden, but keep heartbeat running
    } else if (!document.hidden && state.currentSession) {
        // Page visible again, ensure heartbeat is running
        if (!heartbeatInterval) {
            startHeartbeat();
        }
    }
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (state.currentSession) {
        // Send synchronous request to end session
        navigator.sendBeacon(`${API_BASE}/api/sessions/${state.currentSession}`,
            JSON.stringify({ method: 'DELETE' }));
    }
});
