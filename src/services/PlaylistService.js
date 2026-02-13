const axios = require('axios');
const m3u8Parser = require('m3u8-parser');

class PlaylistService {
  constructor(playlistUrl) {
    this.playlistUrl = playlistUrl;
    this.channels = [];
    this.lastFetch = null;
    this.cacheTTL = 3600000; // 1 hour
  }

  async fetchPlaylist() {
    const now = Date.now();
    
    // Return cached data if still valid
    if (this.lastFetch && (now - this.lastFetch) < this.cacheTTL) {
      console.log('Returning cached playlist');
      return this.channels;
    }

    try {
      console.log('Fetching playlist from:', this.playlistUrl);
      const response = await axios.get(this.playlistUrl, {
        timeout: 30000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      this.channels = this.parseM3U(response.data);
      this.lastFetch = now;
      
      console.log(`Loaded ${this.channels.length} channels`);
      return this.channels;
    } catch (error) {
      console.error('Error fetching playlist:', error.message);
      
      // Return cached data if available, even if expired
      if (this.channels.length > 0) {
        console.log('Returning stale cached playlist due to fetch error');
        return this.channels;
      }
      
      throw new Error('Failed to fetch playlist and no cache available');
    }
  }

  parseM3U(content) {
    const channels = [];
    const lines = content.split('\n');
    let currentChannel = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (line.startsWith('#EXTINF:')) {
        // Parse channel metadata
        currentChannel = {
          id: null,
          name: '',
          logo: '',
          group: '',
          url: ''
        };

        // Extract name (after the comma)
        const nameMatch = line.match(/,(.+)$/);
        if (nameMatch) {
          currentChannel.name = nameMatch[1].trim();
        }

        // Extract logo
        const logoMatch = line.match(/tvg-logo="([^"]+)"/);
        if (logoMatch) {
          currentChannel.logo = logoMatch[1];
        }

        // Extract group
        const groupMatch = line.match(/group-title="([^"]+)"/);
        if (groupMatch) {
          currentChannel.group = groupMatch[1];
        }

        // Extract tvg-id for unique identifier
        const idMatch = line.match(/tvg-id="([^"]+)"/);
        if (idMatch) {
          currentChannel.id = idMatch[1];
        }

      } else if (line && !line.startsWith('#') && currentChannel) {
        // This is the URL line
        currentChannel.url = line;
        
        // Generate ID if not present
        if (!currentChannel.id) {
          currentChannel.id = this.generateChannelId(currentChannel.name, channels.length);
        }

        channels.push(currentChannel);
        currentChannel = null;
      }
    }

    return channels;
  }

  generateChannelId(name, index) {
    // Create a simple ID from name or use index
    const sanitized = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    
    return sanitized || `channel-${index}`;
  }

  async getChannels() {
    return await this.fetchPlaylist();
  }

  async searchChannels(query) {
    const channels = await this.fetchPlaylist();
    const lowerQuery = query.toLowerCase();

    return channels.filter(channel => 
      channel.name.toLowerCase().includes(lowerQuery) ||
      channel.group.toLowerCase().includes(lowerQuery)
    );
  }

  async getChannelById(id) {
    const channels = await this.fetchPlaylist();
    return channels.find(channel => channel.id === id);
  }

  async getChannelsByGroup(group) {
    const channels = await this.fetchPlaylist();
    return channels.filter(channel => channel.group === group);
  }

  async getGroups() {
    const channels = await this.fetchPlaylist();
    const groups = new Set(channels.map(ch => ch.group).filter(g => g));
    return Array.from(groups).sort();
  }
}

module.exports = PlaylistService;
