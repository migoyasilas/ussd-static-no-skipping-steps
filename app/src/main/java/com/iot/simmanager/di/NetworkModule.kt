package com.iot.simmanager.di

import com.google.gson.Gson
import com.google.gson.GsonBuilder
import com.iot.simmanager.data.remote.BackendApi
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import okhttp3.OkHttpClient
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object NetworkModule {

    @Provides
    @Singleton
    fun provideGson(): Gson = GsonBuilder().create()

    @Provides
    @Singleton
    fun provideOkHttpClient(): OkHttpClient {
        return OkHttpClient.Builder()
            .readTimeout(30, TimeUnit.SECONDS)
            .connectTimeout(30, TimeUnit.SECONDS)
            .pingInterval(20, TimeUnit.SECONDS)
            .build()
    }

    // Since the base URL can change, we might need a custom factory or just an OkHttp interceptor
    // but for simplicity, we mock a retrofit instance that might be recreated dynamically.
    // For this boilerplate, let's provide a generic Retrofit. 
    // Usually, dynamic base URLs are handled by interceptors.
    @Provides
    @Singleton
    fun provideBackendApi(client: OkHttpClient, gson: Gson): BackendApi {
        return Retrofit.Builder()
            .baseUrl("https://example.com/") // Placeholder, dynamic interceptor needed in prod
            .client(client)
            .addConverterFactory(GsonConverterFactory.create(gson))
            .build()
            .create(BackendApi::class.java)
    }
}
