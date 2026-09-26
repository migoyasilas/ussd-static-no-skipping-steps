package com.iot.simmanager.service

import android.content.Context
import androidx.hilt.work.HiltWorker
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject
import com.iot.simmanager.data.local.SettingsManager
import com.iot.simmanager.data.local.UssdResultDao
import com.iot.simmanager.domain.repository.UssdRepository
import kotlinx.coroutines.flow.first

@HiltWorker
class UssdWatchdogWorker @AssistedInject constructor(
    @Assisted private val context: Context,
    @Assisted workerParams: WorkerParameters,
    private val settingsManager: SettingsManager,
    private val ussdRepository: UssdRepository,
    private val resultDao: UssdResultDao
) : CoroutineWorker(context, workerParams) {

    override suspend fun doWork(): Result {
        val enabled = settingsManager.serviceEnabledFlow.first()
        if (!enabled) return Result.success()

        val token = settingsManager.authTokenFlow.first()
        
        // 1. Retry failed responses
        val unsynced = resultDao.getUnsyncedResults()
        for (result in unsynced) {
            ussdRepository.saveAndSendResult(result.executionId, result.status, result.response, token)
        }

        // 2. Poll for pending tasks if WebSocket fallback is enabled
        // This is a minimal placeholder for fallback polling mechanism.
        // In a real app we'd fetch from backendApi and execute.
        val fallbackEnabled = settingsManager.websocketFallbackFlow.first()
        if (fallbackEnabled) {
            // Check pending tasks...
        }

        return Result.success()
    }
}
