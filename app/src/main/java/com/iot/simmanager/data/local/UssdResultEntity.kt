package com.iot.simmanager.data.local

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "ussd_results")
data class UssdResultEntity(
    @PrimaryKey val executionId: String,
    val status: String,
    val response: String,
    val timestamp: Long = System.currentTimeMillis(),
    val isSynced: Boolean = false
)
