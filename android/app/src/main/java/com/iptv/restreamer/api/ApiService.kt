package com.iptv.restreamer.api

import com.iptv.restreamer.model.ChannelResponse
import com.iptv.restreamer.model.HeartbeatResponse
import com.iptv.restreamer.model.StartStreamResponse
import retrofit2.Response
import retrofit2.http.*

interface ApiService {
    @GET("api/channels")
    suspend fun getChannels(): Response<ChannelResponse>

    @POST("api/channels/{id}/start")
    suspend fun startStream(@Path("id") channelId: String): Response<StartStreamResponse>

    @POST("api/sessions/{sessionId}/heartbeat")
    suspend fun sendHeartbeat(@Path("sessionId") sessionId: String): Response<HeartbeatResponse>

    @DELETE("api/sessions/{sessionId}")
    suspend fun endSession(@Path("sessionId") sessionId: String): Response<Unit>
}
