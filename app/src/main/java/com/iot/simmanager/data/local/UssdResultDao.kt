package com.iot.simmanager.data.local

import androidx.room.*
import kotlinx.coroutines.flow.Flow

@Dao
interface UssdResultDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertResult(result: UssdResultEntity)

    @Query("SELECT * FROM ussd_results WHERE isSynced = 0 ORDER BY timestamp ASC")
    suspend fun getUnsyncedResults(): List<UssdResultEntity>

    @Query("UPDATE ussd_results SET isSynced = 1 WHERE executionId = :executionId")
    suspend fun markAsSynced(executionId: String)
}
