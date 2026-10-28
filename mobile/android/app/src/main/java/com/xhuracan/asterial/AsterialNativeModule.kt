package com.xhuracan.asterial

import android.app.Activity
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.content.pm.ApplicationInfo
import android.database.Cursor
import android.graphics.BitmapFactory
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.net.Uri
import android.os.Build
import android.provider.OpenableColumns
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.LifecycleEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.io.InputStream
import java.net.HttpURLConnection
import java.net.URL
import java.security.KeyStore
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import javax.net.ssl.HttpsURLConnection

/**
 * Native Kotlin bridge for ASTERIAL Android v1.4.0:
 * - Android KeyStore AES-256-GCM encrypted session token storage
 * - Native HttpsURLConnection resilient HTTPS transport fallback (prevents RN fetch bridge quirks)
 * - Scoped SAF document & image picker (zero legacy READ_EXTERNAL_STORAGE required)
 * - Streaming HttpsURLConnection uploader to private Supabase Storage with byte progress & cancellation
 * - Native ConnectivityManager listener & clipboard utility
 * - Installed APK PackageInfo inspection
 */
class AsterialNativeModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext),
  ActivityEventListener,
  LifecycleEventListener {

  companion object {
    const val NAME = "AsterialNative"
    private const val REQUEST_PICK_DOCUMENT = 41027
    private const val LEGACY_PREFS_NAME = "asterial_secure_prefs"
    private const val ENCRYPTED_PREFS_NAME = "asterial_encrypted_prefs_v2"
    private const val KEYSTORE_PROVIDER = "AndroidKeyStore"
    private const val KEY_ALIAS = "asterial_session_aes_gcm_v1"
    private const val AES_TRANSFORMATION = "AES/GCM/NoPadding"
    private const val GCM_TAG_BITS = 128
  }

  private val executor = Executors.newCachedThreadPool()
  private val activeUploads = ConcurrentHashMap<String, AtomicBoolean>()
  private var pendingPickerPromise: Promise? = null
  private var networkCallback: ConnectivityManager.NetworkCallback? = null
  private val keystoreLock = Any()

  init {
    reactContext.addActivityEventListener(this)
    reactContext.addLifecycleEventListener(this)
    registerNetworkMonitor()
  }

  override fun getName(): String = NAME

  @ReactMethod
  fun addListener(eventName: String) {
    // Required for RN NativeEventEmitter contract
  }

  @ReactMethod
  fun removeListeners(count: Int) {
    // Required for RN NativeEventEmitter contract
  }

  private fun getOrCreateSecretKey(): SecretKey {
    synchronized(keystoreLock) {
      val keyStore = KeyStore.getInstance(KEYSTORE_PROVIDER).apply { load(null) }
      val existing = keyStore.getEntry(KEY_ALIAS, null) as? KeyStore.SecretKeyEntry
      if (existing != null) {
        return existing.secretKey
      }
      val keyGenerator = KeyGenerator.getInstance(
        KeyProperties.KEY_ALGORITHM_AES,
        KEYSTORE_PROVIDER
      )
      val spec = KeyGenParameterSpec.Builder(
        KEY_ALIAS,
        KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
      )
        .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
        .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
        .setKeySize(256)
        .build()
      keyGenerator.init(spec)
      return keyGenerator.generateKey()
    }
  }

  private fun encryptValue(plainText: String): String {
    val cipher = Cipher.getInstance(AES_TRANSFORMATION)
    cipher.init(Cipher.ENCRYPT_MODE, getOrCreateSecretKey())
    val iv = cipher.iv
    val cipherBytes = cipher.doFinal(plainText.toByteArray(Charsets.UTF_8))
    val ivB64 = Base64.encodeToString(iv, Base64.NO_WRAP)
    val ctB64 = Base64.encodeToString(cipherBytes, Base64.NO_WRAP)
    return "v2:$ivB64:$ctB64"
  }

  private fun decryptValue(payload: String): String? {
    if (!payload.startsWith("v2:")) return null
    val parts = payload.split(":", limit = 3)
    if (parts.size != 3) return null
    val iv = Base64.decode(parts[1], Base64.NO_WRAP)
    val cipherBytes = Base64.decode(parts[2], Base64.NO_WRAP)
    val cipher = Cipher.getInstance(AES_TRANSFORMATION)
    cipher.init(
      Cipher.DECRYPT_MODE,
      getOrCreateSecretKey(),
      GCMParameterSpec(GCM_TAG_BITS, iv)
    )
    return String(cipher.doFinal(cipherBytes), Charsets.UTF_8)
  }

  @ReactMethod
  fun getSecureItem(key: String, promise: Promise) {
    try {
      val encPrefs = reactContext.getSharedPreferences(ENCRYPTED_PREFS_NAME, Context.MODE_PRIVATE)
      val stored = encPrefs.getString(key, null)
      if (stored != null) {
        try {
          promise.resolve(decryptValue(stored))
          return
        } catch (_: Throwable) {
          // Corrupted ciphertext or invalidated keystore entry: clean up gracefully
          encPrefs.edit().remove(key).apply()
          promise.resolve(null)
          return
        }
      }

      // One-time transparent migration from v1.3.0 SharedPreferences if present
      val legacyPrefs = reactContext.getSharedPreferences(LEGACY_PREFS_NAME, Context.MODE_PRIVATE)
      val legacyVal = legacyPrefs.getString(key, null)
      if (legacyVal != null) {
        try {
          encPrefs.edit().putString(key, encryptValue(legacyVal)).apply()
          legacyPrefs.edit().remove(key).apply()
        } catch (_: Throwable) {
          // Keep legacy value readable even if keystore hardware fails on an emulator
        }
        promise.resolve(legacyVal)
        return
      }

      promise.resolve(null)
    } catch (e: Exception) {
      promise.reject("ERR_STORAGE_GET", e.message, e)
    }
  }

  @ReactMethod
  fun setSecureItem(key: String, value: String, promise: Promise) {
    try {
      val encPrefs = reactContext.getSharedPreferences(ENCRYPTED_PREFS_NAME, Context.MODE_PRIVATE)
      val encrypted = encryptValue(value)
      encPrefs.edit().putString(key, encrypted).apply()
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("ERR_STORAGE_SET", e.message, e)
    }
  }

  @ReactMethod
  fun removeSecureItem(key: String, promise: Promise) {
    try {
      val encPrefs = reactContext.getSharedPreferences(ENCRYPTED_PREFS_NAME, Context.MODE_PRIVATE)
      encPrefs.edit().remove(key).apply()
      val legacyPrefs = reactContext.getSharedPreferences(LEGACY_PREFS_NAME, Context.MODE_PRIVATE)
      legacyPrefs.edit().remove(key).apply()
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("ERR_STORAGE_REMOVE", e.message, e)
    }
  }

  @ReactMethod
  fun clearSecureStorage(promise: Promise) {
    try {
      reactContext.getSharedPreferences(ENCRYPTED_PREFS_NAME, Context.MODE_PRIVATE)
        .edit()
        .clear()
        .apply()
      reactContext.getSharedPreferences(LEGACY_PREFS_NAME, Context.MODE_PRIVATE)
        .edit()
        .clear()
        .apply()
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("ERR_STORAGE_CLEAR", e.message, e)
    }
  }

  /**
   * Native Android HttpsURLConnection execution path used as a deterministic fallback
   * when React Native's JS fetch layer throws TypeError: Network request failed on OEM/VPN stacks.
   */
  @ReactMethod
  fun nativeHttpsRequest(options: ReadableMap, promise: Promise) {
    val rawUrl = options.getString("url") ?: ""
    val method = (options.getString("method") ?: "GET").uppercase()
    val headersJson = options.getString("headersJson") ?: "{}"
    val bodyText = if (options.hasKey("body") && !options.isNull("body")) {
      options.getString("body")
    } else {
      null
    }
    val timeoutMs = if (options.hasKey("timeoutMs")) options.getInt("timeoutMs") else 15000

    if (!rawUrl.startsWith("https://")) {
      promise.reject("ERR_HTTPS_ONLY", "Native HTTPS transport only accepts https:// endpoints.")
      return
    }

    executor.execute {
      var connection: HttpsURLConnection? = null
      try {
        val parsed = URL(rawUrl)
        connection = (parsed.openConnection() as HttpsURLConnection).apply {
          requestMethod = method
          connectTimeout = timeoutMs
          readTimeout = timeoutMs
          useCaches = false
          instanceFollowRedirects = true
        }

        val headerObj = JSONObject(headersJson)
        val keys = headerObj.keys()
        while (keys.hasNext()) {
          val k = keys.next()
          val v = headerObj.optString(k, "")
          if (k.isNotBlank() && v.isNotEmpty()) {
            connection.setRequestProperty(k, v)
          }
        }

        if (bodyText != null && method != "GET" && method != "HEAD") {
          val payloadBytes = bodyText.toByteArray(Charsets.UTF_8)
          connection.doOutput = true
          connection.setFixedLengthStreamingMode(payloadBytes.size)
          connection.outputStream.use { out ->
            out.write(payloadBytes)
            out.flush()
          }
        }

        val status = connection.responseCode
        val statusMessage = connection.responseMessage ?: ""
        val responseStream: InputStream? = if (status in 200..399) {
          connection.inputStream
        } else {
          connection.errorStream
        }

        val respBody = responseStream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() } ?: ""
        val respHeaders = JSONObject()
        for ((headerName, values) in connection.headerFields) {
          if (headerName != null && !values.isNullOrEmpty()) {
            respHeaders.put(headerName.lowercase(), values.joinToString(", "))
          }
        }

        val result = Arguments.createMap().apply {
          putInt("status", status)
          putBoolean("ok", status in 200..299)
          putString("statusText", statusMessage)
          putString("headersJson", respHeaders.toString())
          putString("bodyText", respBody)
        }
        promise.resolve(result)
      } catch (e: Exception) {
        promise.reject("ERR_NATIVE_HTTPS", e.message ?: "HTTPS connection failed.", e)
      } finally {
        connection?.disconnect()
      }
    }
  }

  @ReactMethod
  fun copyText(text: String, promise: Promise) {
    try {
      val clipboard =
        reactContext.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
      clipboard.setPrimaryClip(ClipData.newPlainText("ASTERIAL", text))
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("ERR_CLIPBOARD", e.message, e)
    }
  }

  @ReactMethod
  fun getNetworkState(promise: Promise) {
    try {
      val map = Arguments.createMap()
      map.putBoolean("isOnline", isCurrentlyOnline())
      promise.resolve(map)
    } catch (e: Exception) {
      promise.reject("ERR_NET_STATE", e.message, e)
    }
  }

  @ReactMethod
  fun getInstalledAppInfo(promise: Promise) {
    try {
      val pm = reactContext.packageManager
      val pkgName = reactContext.packageName
      val pkgInfo = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        pm.getPackageInfo(pkgName, android.content.pm.PackageManager.PackageInfoFlags.of(0))
      } else {
        @Suppress("DEPRECATION")
        pm.getPackageInfo(pkgName, 0)
      }
      val versionCode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
        pkgInfo.longVersionCode.toInt()
      } else {
        @Suppress("DEPRECATION")
        pkgInfo.versionCode
      }
      val isDebuggable =
        (reactContext.applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE) != 0

      val rawVersionName = pkgInfo.versionName ?: "1.4.0"
      val baseVersion = rawVersionName.removeSuffix("-debug")

      val map = Arguments.createMap().apply {
        putString("applicationId", pkgName)
        putString("versionName", rawVersionName)
        putString("baseVersionName", baseVersion)
        putInt("versionCode", versionCode)
        putBoolean("isDebugBuild", isDebuggable)
      }
      promise.resolve(map)
    } catch (e: Exception) {
      promise.reject("ERR_APP_INFO", e.message, e)
    }
  }

  @ReactMethod
  fun pickMediaOrDocument(options: ReadableMap, promise: Promise) {
    val activity = reactApplicationContext.currentActivity
    if (activity == null) {
      promise.reject("ERR_NO_ACTIVITY", "Foreground Android Activity is unavailable.")
      return
    }
    if (pendingPickerPromise != null) {
      promise.reject("ERR_PICKER_BUSY", "Another file selection is already in progress.")
      return
    }

    val kind = options.getString("kind") ?: "attachment"
    pendingPickerPromise = promise

    try {
      val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
        addCategory(Intent.CATEGORY_OPENABLE)
        if (kind == "avatar" || kind == "social-image") {
          type = "image/*"
          putExtra(
            Intent.EXTRA_MIME_TYPES,
            arrayOf("image/png", "image/jpeg", "image/webp", "image/gif")
          )
        } else {
          type = "*/*"
          putExtra(
            Intent.EXTRA_MIME_TYPES,
            arrayOf(
              "image/png",
              "image/jpeg",
              "image/webp",
              "image/gif",
              "application/pdf",
              "text/plain",
              "text/markdown",
              "text/csv",
              "application/json",
              "application/zip"
            )
          )
        }
      }
      activity.startActivityForResult(intent, REQUEST_PICK_DOCUMENT)
    } catch (e: Exception) {
      pendingPickerPromise = null
      promise.reject("ERR_PICKER_LAUNCH", e.message, e)
    }
  }

  @ReactMethod
  fun cancelUpload(uploadId: String, promise: Promise) {
    val flag = activeUploads[uploadId]
    if (flag != null) {
      flag.set(true)
      promise.resolve(true)
    } else {
      promise.resolve(false)
    }
  }

  @ReactMethod
  fun uploadUriToSupabaseStorage(options: ReadableMap, promise: Promise) {
    val uploadId = options.getString("uploadId") ?: ""
    val uriStr = options.getString("uri") ?: ""
    val uploadUrl = options.getString("uploadUrl") ?: ""
    val anonKey = options.getString("anonKey") ?: ""
    val accessToken = options.getString("accessToken") ?: ""
    val mimeType = options.getString("mimeType") ?: "application/octet-stream"
    val upsert = if (options.hasKey("upsert")) options.getBoolean("upsert") else false
    val totalBytes = if (options.hasKey("totalBytes")) options.getDouble("totalBytes").toLong() else -1L

    if (uploadId.isBlank() || uriStr.isBlank() || uploadUrl.isBlank() || accessToken.isBlank()) {
      promise.reject("ERR_UPLOAD_ARGS", "Missing required upload parameters.")
      return
    }

    val cancelled = AtomicBoolean(false)
    activeUploads[uploadId] = cancelled

    executor.execute {
      var connection: HttpURLConnection? = null
      var inputStream: InputStream? = null
      try {
        val uri = Uri.parse(uriStr)
        inputStream = reactContext.contentResolver.openInputStream(uri)
          ?: throw IllegalStateException("Unable to open selected file stream.")

        val url = URL(uploadUrl)
        connection = (url.openConnection() as HttpURLConnection).apply {
          requestMethod = "POST"
          doOutput = true
          connectTimeout = 20_000
          readTimeout = 60_000
          setRequestProperty("Authorization", "Bearer $accessToken")
          if (anonKey.isNotBlank()) {
            setRequestProperty("apikey", anonKey)
          }
          setRequestProperty("Content-Type", mimeType)
          setRequestProperty("x-upsert", if (upsert) "true" else "false")
          setRequestProperty("cache-control", "3600")
          if (totalBytes > 0) {
            setFixedLengthStreamingMode(totalBytes)
          } else {
            setChunkedStreamingMode(32 * 1024)
          }
        }

        val buffer = ByteArray(16 * 1024)
        var sentBytes = 0L
        var lastEmitTime = 0L

        connection.outputStream.use { out ->
          while (true) {
            if (cancelled.get()) {
              connection.disconnect()
              throw InterruptedException("Upload cancelled.")
            }
            val read = inputStream.read(buffer)
            if (read <= 0) break
            out.write(buffer, 0, read)
            sentBytes += read
            val now = System.currentTimeMillis()
            if (now - lastEmitTime >= 80 || (totalBytes > 0 && sentBytes >= totalBytes)) {
              lastEmitTime = now
              emitUploadProgress(uploadId, sentBytes, totalBytes)
            }
          }
          out.flush()
        }

        val status = connection.responseCode
        val responseBody = try {
          val stream = if (status in 200..299) connection.inputStream else connection.errorStream
          stream?.bufferedReader()?.use { it.readText() } ?: ""
        } catch (_: Exception) {
          ""
        }

        if (status !in 200..299) {
          promise.reject(
            "ERR_STORAGE_HTTP_$status",
            if (responseBody.isNotBlank()) responseBody else "Storage upload failed with HTTP $status"
          )
          return@execute
        }

        emitUploadProgress(uploadId, sentBytes, if (totalBytes > 0) totalBytes else sentBytes)
        val res = Arguments.createMap().apply {
          putBoolean("ok", true)
          putInt("status", status)
          putDouble("bytesSent", sentBytes.toDouble())
        }
        promise.resolve(res)
      } catch (ie: InterruptedException) {
        promise.reject("ERR_UPLOAD_CANCELLED", ie.message ?: "Upload cancelled", ie)
      } catch (e: Exception) {
        promise.reject("ERR_UPLOAD_FAILED", e.message ?: "Upload failed", e)
      } finally {
        activeUploads.remove(uploadId)
        try {
          inputStream?.close()
        } catch (_: Exception) {
        }
        connection?.disconnect()
      }
    }
  }

  private fun emitUploadProgress(uploadId: String, sentBytes: Long, totalBytes: Long) {
    if (!reactContext.hasActiveReactInstance()) return
    val map = Arguments.createMap().apply {
      putString("uploadId", uploadId)
      putDouble("bytesSent", sentBytes.toDouble())
      putDouble("totalBytes", totalBytes.toDouble())
      val pct = if (totalBytes > 0) {
        ((sentBytes.toDouble() / totalBytes.toDouble()) * 100.0).coerceIn(0.0, 100.0)
      } else {
        0.0
      }
      putDouble("percent", pct)
    }
    reactContext
      .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      .emit("asterialUploadProgress", map)
  }

  private fun emitNetworkState(isOnline: Boolean) {
    if (!reactContext.hasActiveReactInstance()) return
    val map = Arguments.createMap().apply {
      putBoolean("isOnline", isOnline)
    }
    reactContext
      .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      .emit("asterialNetworkState", map)
  }

  private fun isCurrentlyOnline(): Boolean {
    val cm =
      reactContext.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
    val active = cm.activeNetwork ?: return false
    val caps = cm.getNetworkCapabilities(active) ?: return false
    return caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
  }

  private fun registerNetworkMonitor() {
    try {
      val cm =
        reactContext.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
      val cb = object : ConnectivityManager.NetworkCallback() {
        override fun onAvailable(network: Network) {
          emitNetworkState(true)
        }

        override fun onLost(network: Network) {
          emitNetworkState(isCurrentlyOnline())
        }

        override fun onCapabilitiesChanged(
          network: Network,
          networkCapabilities: NetworkCapabilities
        ) {
          emitNetworkState(
            networkCapabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
          )
        }
      }
      val req = NetworkRequest.Builder()
        .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
        .build()
      cm.registerNetworkCallback(req, cb)
      networkCallback = cb
    } catch (_: Exception) {
    }
  }

  override fun onActivityResult(
    activity: Activity,
    requestCode: Int,
    resultCode: Int,
    data: Intent?
  ) {
    if (requestCode != REQUEST_PICK_DOCUMENT) return
    val promise = pendingPickerPromise ?: return
    pendingPickerPromise = null

    if (resultCode != Activity.RESULT_OK || data?.data == null) {
      promise.resolve(null)
      return
    }

    val uri = data.data!!
    executor.execute {
      try {
        val resolver = reactContext.contentResolver
        var displayName = "attachment"
        var byteSize = 0L

        val cursor: Cursor? = resolver.query(uri, null, null, null, null)
        cursor?.use {
          if (it.moveToFirst()) {
            val nameIdx = it.getColumnIndex(OpenableColumns.DISPLAY_NAME)
            if (nameIdx >= 0 && !it.isNull(nameIdx)) {
              displayName = it.getString(nameIdx)
            }
            val sizeIdx = it.getColumnIndex(OpenableColumns.SIZE)
            if (sizeIdx >= 0 && !it.isNull(sizeIdx)) {
              byteSize = it.getLong(sizeIdx)
            }
          }
        }

        val mimeType = resolver.getType(uri) ?: "application/octet-stream"

        val headerBytes = ByteArray(32)
        var headerLen = 0
        resolver.openInputStream(uri)?.use { stream ->
          headerLen = stream.read(headerBytes, 0, headerBytes.size).coerceAtLeast(0)
        }

        if (byteSize <= 0L) {
          resolver.openInputStream(uri)?.use { stream ->
            val countBuf = ByteArray(16 * 1024)
            var total = 0L
            while (true) {
              val r = stream.read(countBuf)
              if (r <= 0) break
              total += r
            }
            byteSize = total
          }
        }

        var imgWidth: Int? = null
        var imgHeight: Int? = null
        if (mimeType.startsWith("image/")) {
          resolver.openInputStream(uri)?.use { imgStream ->
            val opts = BitmapFactory.Options().apply { inJustDecodeBounds = true }
            BitmapFactory.decodeStream(imgStream, null, opts)
            if (opts.outWidth > 0 && opts.outHeight > 0) {
              imgWidth = opts.outWidth
              imgHeight = opts.outHeight
            }
          }
        }

        val headerArray = Arguments.createArray()
        val copyStream = ByteArrayOutputStream()
        if (headerLen > 0) {
          copyStream.write(headerBytes, 0, headerLen)
        }
        for (b in copyStream.toByteArray()) {
          headerArray.pushInt(b.toInt() and 0xFF)
        }

        val result = Arguments.createMap().apply {
          putString("uri", uri.toString())
          putString("fileName", displayName)
          putString("mimeType", mimeType)
          putDouble("byteSize", byteSize.toDouble())
          putArray("headerBytes", headerArray)
          if (imgWidth != null && imgHeight != null) {
            putInt("width", imgWidth!!)
            putInt("height", imgHeight!!)
          } else {
            putNull("width")
            putNull("height")
          }
        }
        promise.resolve(result)
      } catch (e: Exception) {
        promise.reject("ERR_PICKER_READ", e.message, e)
      }
    }
  }

  override fun onNewIntent(intent: Intent) {
    // Handled by React Native Linking module for asterial:// deep links
  }

  override fun onHostResume() {
    emitNetworkState(isCurrentlyOnline())
  }

  override fun onHostPause() {}

  override fun onHostDestroy() {
    try {
      val cm =
        reactContext.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
      networkCallback?.let { cm.unregisterNetworkCallback(it) }
      networkCallback = null
    } catch (_: Exception) {
    }
  }
}
