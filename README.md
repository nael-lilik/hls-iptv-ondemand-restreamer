# HLS IPTV On-Demand Restreamer

Sistem restreaming IPTV berbasis HLS yang efisien dengan manajemen proses on-demand. Mendukung multiple concurrent viewers tanpa duplikasi proses, dengan interface modern untuk berbagai platform.

## ✨ Features

- 🎯 **On-Demand Streaming** - FFmpeg process dimulai otomatis saat ada viewer
- 🔄 **Process Deduplication** - Multiple viewers berbagi stream yang sama
- 🧹 **Auto Cleanup** - Process otomatis berhenti saat tidak ada viewer
- 📱 **Responsive Design** - Optimized untuk mobile, desktop, dan TV
- 📺 **Chromecast Support** - Cast ke TV dengan Google Cast
- 🎨 **Modern UI** - Dark theme dengan glassmorphism dan smooth animations
- 🔍 **Search & Filter** - Cari channel berdasarkan nama atau kategori
- 👥 **Real-time Stats** - Monitor active streams dan viewer count
- 🐳 **Docker Ready** - Deploy dengan Docker atau Podman
- 📦 **PWA Support** - Install sebagai app di Android TV

## 🏗️ Architecture

```
Client (Browser/TV) → Web UI → REST API → Stream Manager → FFmpeg → HLS Segments
                                    ↓
                              Session Manager (Heartbeat & Cleanup)
```

### Core Components

- **PlaylistService** - Fetch dan parse M3U8 playlist dari iptv-org
- **FFmpegService** - Spawn dan manage FFmpeg processes untuk HLS transcoding
- **StreamManager** - Lifecycle management dengan viewer tracking
- **SessionManager** - Session tracking dengan heartbeat mechanism

## 🚀 Quick Start

### Prerequisites

- Docker atau Podman
- 2GB+ RAM
- 2+ CPU cores

### Installation

1. **Clone repository**
```bash
git clone <repository-url>
cd hls-iptv-ondemand-restreamer
```

2. **Setup environment**
```bash
cp .env.example .env
# Edit .env jika perlu customize configuration
```

3. **Run with Docker**
```bash
docker-compose up -d
```

4. **Run with Podman**
```bash
podman-compose up -d
```

5. **Access aplikasi**
```
http://localhost:3000
```

### Development Mode

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev
```

## 📖 Usage

### Web Interface

1. Buka browser ke `http://localhost:3000`
2. Browse atau search channel yang diinginkan
3. Click channel untuk mulai streaming
4. Video akan otomatis play setelah stream ready

### Chromecast

1. Pastikan device Chromecast ada di network yang sama
2. Click icon Cast di header
3. Pilih device Chromecast
4. Stream akan otomatis di-cast ke TV

### Keyboard Shortcuts

- `Space` / `K` - Play/Pause
- `F` - Fullscreen
- `M` - Mute/Unmute
- `↑` / `↓` - Volume up/down
- Double-click video - Picture-in-Picture

## 🔧 Configuration

Edit `.env` file untuk customize:

```env
# Server
PORT=3000

# IPTV Playlist
PLAYLIST_URL=https://iptv-org.github.io/iptv/index.m3u

# HLS Settings
HLS_SEGMENT_DURATION=6
HLS_LIST_SIZE=10
HLS_OUTPUT_DIR=/tmp/hls

# Session
SESSION_TIMEOUT=30000
HEARTBEAT_INTERVAL=10000

# FFmpeg
FFMPEG_PRESET=veryfast
FFMPEG_VIDEO_CODEC=libx264
FFMPEG_AUDIO_CODEC=aac
```

## 📡 API Endpoints

### Channels

- `GET /api/channels` - List semua channels
- `GET /api/channels/search?q=<query>` - Search channels
- `GET /api/groups` - List channel groups
- `GET /api/groups/:group/channels` - Channels by group

### Streaming

- `POST /api/channels/:id/start` - Start streaming channel
- `GET /stream/:channelId/playlist.m3u8` - HLS playlist
- `GET /stream/:channelId/segment_*.ts` - HLS segments

### Sessions

- `POST /api/sessions/:sessionId/heartbeat` - Keep session alive
- `DELETE /api/sessions/:sessionId` - End session

### Stats

- `GET /api/stats` - System statistics
- `GET /api/streams/:channelId/status` - Stream status

## 🎯 How It Works

### On-Demand Streaming

1. User click channel → API creates session
2. StreamManager checks if FFmpeg already running for channel
3. If not running → FFmpegService spawns new process
4. If already running → Reuse existing process
5. Add viewer to stream's viewer count
6. Return HLS playlist URL to client

### Heartbeat Mechanism

- Client sends heartbeat every 10 seconds
- SessionManager tracks last heartbeat time
- Sessions timeout after 30 seconds without heartbeat
- On timeout → Remove viewer from stream
- If viewer count = 0 → Stop FFmpeg process

### Auto Cleanup

- StreamManager runs cleanup every 60 seconds
- Remove streams with 0 viewers idle > 5 minutes
- FFmpegService cleans up HLS segments

## 🔍 Monitoring

### Real-time Stats

Web interface menampilkan:
- Total active streams
- Total viewers across all streams
- Per-channel viewer count

### Logs

```bash
# Docker logs
docker-compose logs -f

# Podman logs
podman-compose logs -f
```

## 🐛 Troubleshooting

### Stream tidak start

- Check FFmpeg installed di container
- Verify source URL accessible
- Check logs untuk error details

### High CPU/Memory usage

- Reduce concurrent streams
- Adjust FFmpeg preset (veryfast → ultrafast)
- Increase server resources

### Chromecast tidak muncul

- Pastikan di network yang sama
- Check browser support Google Cast
- Reload page

## 🚀 Future Enhancements

- [ ] Redis untuk distributed session management
- [ ] Multiple quality levels (adaptive bitrate)
- [ ] DVR functionality (timeshift)
- [ ] EPG (Electronic Program Guide) integration
- [ ] User authentication
- [ ] Favorite channels
- [ ] Native Android app dengan Kotlin
- [ ] Admin dashboard

## 📄 License

MIT

## 🙏 Credits

- IPTV Playlist: [iptv-org](https://github.com/iptv-org/iptv)
- HLS Player: [hls.js](https://github.com/video-dev/hls.js)
- Streaming: [FFmpeg](https://ffmpeg.org/)

---

**Enjoy streaming! 📺✨**
