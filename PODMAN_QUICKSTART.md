# Quick Start dengan Podman

## Prerequisites
- Podman terinstall di laptop
- podman-compose (atau podman-docker alias)

## Installation

### 1. Install podman-compose (jika belum)
```bash
pip3 install podman-compose
```

Atau gunakan podman dengan docker-compose syntax:
```bash
# Buat alias (optional)
alias docker-compose='podman-compose'
```

### 2. Build dan Run

```bash
# Build image
podman-compose build

# Run container
podman-compose up -d

# Atau tanpa compose, manual:
podman build -t hls-iptv-restreamer .
podman run -d -p 3000:3000 --name iptv-restreamer hls-iptv-restreamer
```

### 3. Check Status

```bash
# Lihat container yang running
podman ps

# Lihat logs
podman-compose logs -f
# atau
podman logs -f iptv-restreamer
```

### 4. Access Aplikasi

Buka browser ke: **http://localhost:3000**

### 5. Stop Container

```bash
# Dengan compose
podman-compose down

# Manual
podman stop iptv-restreamer
podman rm iptv-restreamer
```

## Testing Lokal (Tanpa Container)

Jika ingin test tanpa container terlebih dahulu:

```bash
# Install dependencies
npm install

# Pastikan FFmpeg terinstall di sistem
ffmpeg -version

# Run development server
npm run dev
```

**Note:** Untuk development lokal, pastikan FFmpeg sudah terinstall di Windows. Download dari: https://ffmpeg.org/download.html

## Troubleshooting

### Port sudah digunakan
```bash
# Ganti port di .env
PORT=3001

# Atau di docker-compose.yml
ports:
  - "3001:3000"
```

### FFmpeg tidak ditemukan di container
Container sudah include FFmpeg di Alpine Linux. Jika ada masalah:
```bash
# Masuk ke container
podman exec -it iptv-restreamer sh

# Check FFmpeg
ffmpeg -version
```

### Permission issues dengan Podman
```bash
# Run dengan user namespace
podman-compose up -d --userns=keep-id
```

## Next Steps

Setelah aplikasi running:
1. Browse channel list (akan load ~1000+ channels dari iptv-org)
2. Search atau filter berdasarkan kategori
3. Click channel untuk mulai streaming
4. Test dengan multiple tabs untuk verify process deduplication

Enjoy! 📺
