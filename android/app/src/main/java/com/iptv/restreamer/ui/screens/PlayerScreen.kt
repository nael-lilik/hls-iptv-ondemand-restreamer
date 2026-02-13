package com.iptv.restreamer.ui.screens

import android.net.Uri
import android.util.Log
import android.view.ViewGroup
import android.widget.FrameLayout
import androidx.annotation.OptIn
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.viewinterop.AndroidView
import androidx.media3.common.MediaItem
import androidx.media3.common.util.UnstableApi
import androidx.media3.datasource.DefaultHttpDataSource
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.hls.HlsMediaSource
import androidx.media3.ui.PlayerView
import com.iptv.restreamer.api.ApiClient
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

@OptIn(UnstableApi::class)
@Composable
fun PlayerScreen(channelId: String) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    
    var player by remember { mutableStateOf<ExoPlayer?>(null) }
    var sessionId by remember { mutableStateOf<String?>(null) }
    var isLoading by remember { mutableStateOf(true) }
    var statusMessage by remember { mutableStateOf("Initializing Stream...") }

    // Cleanup on Dispose
    DisposableEffect(Unit) {
        onDispose {
            player?.release()
            if (sessionId != null) {
                // Background fire-and-forget for cleanup
                val endingSessionId = sessionId
                kotlinx.coroutines.GlobalScope.launch {
                    try {
                        ApiClient.service.endSession(endingSessionId!!)
                    } catch (e: Exception) {
                        e.printStackTrace()
                    }
                }
            }
        }
    }

    LaunchedEffect(channelId) {
        try {
            val response = ApiClient.service.startStream(channelId)
            if (response.isSuccessful && response.body() != null) {
                val body = response.body()!!
                sessionId = body.sessionId
                
                // URL Construction (matching previous logic)
                val relativePath = body.playlistUrl.trimStart('/')
                val fullUrl = "${ApiClient.BASE_URL}$relativePath"
                
                // Initialize ExoPlayer
                val newPlayer = ExoPlayer.Builder(context).build()
                val dataSourceFactory = DefaultHttpDataSource.Factory()
                val mediaSource = HlsMediaSource.Factory(dataSourceFactory)
                    .createMediaSource(MediaItem.fromUri(Uri.parse(fullUrl)))

                newPlayer.setMediaSource(mediaSource)
                newPlayer.prepare()
                newPlayer.playWhenReady = true
                player = newPlayer
                
                isLoading = false

                // Start Heartbeat loop
                while (isActive) {
                    try {
                        ApiClient.service.sendHeartbeat(sessionId!!)
                    } catch (e: Exception) {
                         Log.e("PlayerScreen", "Heartbeat failed", e)
                    }
                    delay(10000)
                }

            } else {
                statusMessage = "Failed to start: ${response.code()}"
            }
        } catch (e: Exception) {
            statusMessage = "Error: ${e.message}"
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black)
    ) {
        if (player != null) {
            AndroidView(
                factory = { ctx ->
                    PlayerView(ctx).apply {
                        this.player = player
                        layoutParams = FrameLayout.LayoutParams(
                            ViewGroup.LayoutParams.MATCH_PARENT,
                            ViewGroup.LayoutParams.MATCH_PARENT
                        )
                        useController = true
                        setShowBuffering(PlayerView.SHOW_BUFFERING_WHEN_PLAYING)
                    }
                },
                modifier = Modifier.fillMaxSize()
            )
        }

        if (isLoading) {
            CircularProgressIndicator(modifier = Modifier.align(Alignment.Center))
            Text(
                text = statusMessage,
                color = Color.White,
                modifier = Modifier.align(Alignment.BottomCenter)
            )
        }
    }
}
