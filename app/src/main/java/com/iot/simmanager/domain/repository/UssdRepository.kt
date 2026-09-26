package com.iot.simmanager.domain.repository

import com.google.gson.Gson
import com.iot.simmanager.data.local.UssdResultDao
import com.iot.simmanager.data.local.UssdResultEntity
import com.iot.simmanager.data.remote.BackendApi
import com.iot.simmanager.data.remote.WebSocketClient
import com.iot.simmanager.data.remote.models.UssdResponse
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class UssdRepository @Inject constructor(
    private val resultDao: UssdResultDao,
    private val backendApi: BackendApi,
    private val webSocketClient: WebSocketClient,
    private val gson: Gson
) {

    suspend fun saveAndSendResult(executionId: String, status: String, text: String, token: String) {
        // Save locally first
        resultDao.insertResult(UssdResultEntity(executionId, status, text))
        
        val responseModel = UssdResponse(executionId, status, text)

        // Try incredibly fast outbound socket push first
        if (webSocketClient.connectionState.value) {
            try {
                webSocketClient.sendPayload(gson.toJson(responseModel))
                resultDao.markAsSynced(executionId)
                return
            } catch (e: Exception) {
               // Fallback below
            }
        }

        // Try sending to REST backend fallback
        try {
            val response = backendApi.submitResponse(
                token = "Bearer $token",
                response = responseModel
            )
            if (response.isSuccessful) {
                resultDao.markAsSynced(executionId)
            }
        } catch (e: Exception) {
            // Leave as unsynced for WorkManager watchdog to pickup
        }
    }
}
