// HLS Player management
let hls = null;
let castSession = null;

// Initialize HLS player
window.initPlayer = function (playlistUrl) {
    const video = document.getElementById('videoPlayer');
    const playerLoading = document.getElementById('playerLoading');
    const playerError = document.getElementById('playerError');
    const retryBtn = document.getElementById('retryBtn');

    console.log('Initializing player with:', playlistUrl);

    // Clean up existing player
    if (hls) {
        hls.destroy();
    }

    const fullPlaylistUrl = `${window.location.origin}${playlistUrl}`;

    if (Hls.isSupported()) {
        hls = new Hls({
            debug: false,
            enableWorker: true,
            lowLatencyMode: true,
            backBufferLength: 90,
            maxBufferLength: 30,
            maxMaxBufferLength: 60
        });

        hls.loadSource(fullPlaylistUrl);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
            console.log('Manifest parsed, starting playback');
            playerLoading.style.display = 'none';
            video.play().catch(err => {
                console.error('Autoplay failed:', err);
                // Show play button or handle autoplay restriction
            });
        });

        hls.on(Hls.Events.ERROR, (event, data) => {
            console.error('HLS error:', data);

            if (data.fatal) {
                switch (data.type) {
                    case Hls.ErrorTypes.NETWORK_ERROR:
                        console.log('Network error, attempting recovery...');
                        hls.startLoad();
                        break;
                    case Hls.ErrorTypes.MEDIA_ERROR:
                        console.log('Media error, attempting recovery...');
                        hls.recoverMediaError();
                        break;
                    default:
                        console.error('Fatal error, cannot recover');
                        playerLoading.style.display = 'none';
                        playerError.style.display = 'block';
                        break;
                }
            }
        });

        // Retry button
        retryBtn.onclick = () => {
            playerError.style.display = 'none';
            playerLoading.style.display = 'block';
            hls.loadSource(fullPlaylistUrl);
        };

    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Native HLS support (Safari)
        console.log('Using native HLS support');
        video.src = fullPlaylistUrl;

        video.addEventListener('loadedmetadata', () => {
            playerLoading.style.display = 'none';
            video.play();
        });

        video.addEventListener('error', () => {
            console.error('Video error');
            playerLoading.style.display = 'none';
            playerError.style.display = 'block';
        });

        retryBtn.onclick = () => {
            playerError.style.display = 'none';
            playerLoading.style.display = 'block';
            video.load();
        };
    } else {
        console.error('HLS not supported');
        playerLoading.style.display = 'none';
        playerError.style.display = 'block';
    }
};

// Stop player
window.stopPlayer = function () {
    const video = document.getElementById('videoPlayer');

    if (hls) {
        hls.destroy();
        hls = null;
    }

    video.pause();
    video.src = '';
    video.load();
};

// Google Cast integration
window['__onGCastApiAvailable'] = function (isAvailable) {
    if (isAvailable) {
        initializeCastApi();
    }
};

function initializeCastApi() {
    const castBtn = document.getElementById('castBtn');

    cast.framework.CastContext.getInstance().setOptions({
        receiverApplicationId: chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID,
        autoJoinPolicy: chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED
    });

    // Show cast button
    castBtn.style.display = 'flex';

    // Cast button click
    castBtn.addEventListener('click', () => {
        const castContext = cast.framework.CastContext.getInstance();
        const castSession = castContext.getCurrentSession();

        if (castSession) {
            // Already casting, stop it
            castContext.endCurrentSession(true);
        } else {
            // Request cast session
            castContext.requestSession().then(
                () => {
                    console.log('Cast session started');
                    loadMediaToCast();
                },
                (error) => {
                    console.error('Cast session error:', error);
                }
            );
        }
    });

    // Listen for cast state changes
    const player = new cast.framework.RemotePlayer();
    const playerController = new cast.framework.RemotePlayerController(player);

    playerController.addEventListener(
        cast.framework.RemotePlayerEventType.IS_CONNECTED_CHANGED,
        () => {
            if (player.isConnected) {
                console.log('Connected to cast device');
                castBtn.classList.add('casting');
                loadMediaToCast();
            } else {
                console.log('Disconnected from cast device');
                castBtn.classList.remove('casting');
            }
        }
    );
}

function loadMediaToCast() {
    const castSession = cast.framework.CastContext.getInstance().getCurrentSession();

    if (!castSession) {
        return;
    }

    const video = document.getElementById('videoPlayer');
    const currentSrc = video.src;

    if (!currentSrc) {
        return;
    }

    const mediaInfo = new chrome.cast.media.MediaInfo(currentSrc, 'application/x-mpegURL');

    // Add metadata
    const metadata = new chrome.cast.media.GenericMediaMetadata();
    metadata.title = document.getElementById('playerTitle').textContent;
    metadata.subtitle = document.getElementById('playerGroup').textContent;

    mediaInfo.metadata = metadata;

    const request = new chrome.cast.media.LoadRequest(mediaInfo);

    castSession.loadMedia(request).then(
        () => {
            console.log('Media loaded to cast device');
            // Pause local video
            video.pause();
        },
        (error) => {
            console.error('Error loading media to cast:', error);
        }
    );
}

// Picture-in-Picture support
const video = document.getElementById('videoPlayer');

if (document.pictureInPictureEnabled) {
    video.addEventListener('dblclick', async () => {
        try {
            if (document.pictureInPictureElement) {
                await document.exitPictureInPicture();
            } else {
                await video.requestPictureInPicture();
            }
        } catch (error) {
            console.error('PiP error:', error);
        }
    });
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (!video.src) return;

    switch (e.key) {
        case ' ':
        case 'k':
            e.preventDefault();
            video.paused ? video.play() : video.pause();
            break;
        case 'f':
            e.preventDefault();
            if (document.fullscreenElement) {
                document.exitFullscreen();
            } else {
                video.requestFullscreen();
            }
            break;
        case 'm':
            e.preventDefault();
            video.muted = !video.muted;
            break;
        case 'ArrowUp':
            e.preventDefault();
            video.volume = Math.min(1, video.volume + 0.1);
            break;
        case 'ArrowDown':
            e.preventDefault();
            video.volume = Math.max(0, video.volume - 0.1);
            break;
    }
});
