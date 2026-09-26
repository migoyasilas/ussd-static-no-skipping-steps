package com.iot.simmanager.di

import android.content.Context
import androidx.room.Room
import com.iot.simmanager.data.local.AppDatabase
import com.iot.simmanager.data.local.SettingsManager
import com.iot.simmanager.data.local.UssdResultDao
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object AppModule {

    @Provides
    @Singleton
    fun provideSettingsManager(@ApplicationContext context: Context): SettingsManager {
        return SettingsManager(context)
    }

    @Provides
    @Singleton
    fun provideAppDatabase(@ApplicationContext context: Context): AppDatabase {
        return Room.databaseBuilder(
            context,
            AppDatabase::class.java,
            "iot_sim_manager.db"
        ).build()
    }

    @Provides
    fun provideUssdResultDao(appDatabase: AppDatabase): UssdResultDao {
        return appDatabase.ussdResultDao()
    }
}
