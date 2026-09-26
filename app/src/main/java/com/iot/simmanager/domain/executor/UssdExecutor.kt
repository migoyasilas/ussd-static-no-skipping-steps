package com.iot.simmanager.domain.executor

import com.iot.simmanager.data.remote.models.UssdRequest

interface UssdExecutor {
    suspend fun execute(request: UssdRequest, callback: (String, String) -> Unit)
}
