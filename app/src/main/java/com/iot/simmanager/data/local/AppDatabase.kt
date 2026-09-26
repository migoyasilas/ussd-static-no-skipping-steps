package com.iot.simmanager.data.local

import androidx.room.Database
import androidx.room.RoomDatabase

@Database(entities = [UssdResultEntity::class], version = 1, exportSchema = false)
abstract class AppDatabase : RoomDatabase() {
    abstract fun ussdResultDao(): UssdResultDao
}
