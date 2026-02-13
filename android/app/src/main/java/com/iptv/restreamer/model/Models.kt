package com.iptv.restreamer.model

import com.google.gson.annotations.SerializedName

data class ChannelResponse(
    val success: Boolean,
    val count: Int,
    val channels: List<Channel>
)

data class Channel(
    val id: String,
    val name: String,
    val logo: String?,
    val group: String?,
    @SerializedName("url") val sourceUrl: String?
)

data class StartStreamResponse(
    val success: Boolean,
    val sessionId: String,
    val playlistUrl: String, // Relative URL e.g. /stream/id/playlist.m3u8
    val stream: StreamStatus?
)

data class StreamStatus(
    val status: String, // running, starting, stopped
    val viewers: Int
)

data class HeartbeatResponse(
    val success: Boolean,
    val sessionId: String,
    val timestamp: Long
)
