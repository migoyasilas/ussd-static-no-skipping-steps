package com.iot.simmanager.data.remote

import com.iot.simmanager.data.remote.models.UssdRequest
import com.iot.simmanager.data.remote.models.UssdResponse
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.POST

interface BackendApi {

    @GET("api/ussd/pending")
    suspend fun getPendingTasks(@Header("Authorization") token: String): Response<List<UssdRequest>>

    @POST("api/ussd/response")
    suspend fun submitResponse(
        @Header("Authorization") token: String,
        @Body response: UssdResponse
    ): Response<Unit>
}
