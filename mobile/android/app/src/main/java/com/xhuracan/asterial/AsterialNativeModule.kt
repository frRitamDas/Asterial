package com.xhuracan.asterial

import android.app.Activity
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.graphics.BitmapFactory
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.Uri
import android.os.Build
import android.provider.OpenableColumns
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.BaseActivityEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.UiThreadUtil
import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.io.BufferedInputStream
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

@ReactModule(name = AsterialNativeModule.NAME)
class AsterialNativeModule(
    reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {

  companion object {
    const val NAME = "AsterialNative"
    private const val PICK_DOCUMENT_REQUEST = 48130
    private val AVATAR_MIME_TYPES = arrayOf(
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif",
    )
    private val ATTACHMENT_MIME_TYPES = arrayOf(
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif",
        "application/pdf",
        "text/plain",
        "text/csv",
        "application/json",
        "application/zip",
        "application/x-zip-compressed",
    )
  }

  private val ioExecutor = Executors.newCachedThreadPool()
  private val activeUploads = ConcurrentHashMap<String, AtomicBoolean>()
  @Volatile private var pendingPickPromise: Promise? = null
  private var networkCallback: ConnectivityManager.NetworkCallback? = null

  private val activityEventListener = object : BaseActivityEventListener() {
    override fun onActivityResult(
        activity: Activity,
        requestCode: Int,
        resultCode: Int,
        data: Intent?,
    ) {
      if (requestCode != PICK_DOCUMENT_REQUEST) return
      val promise = pendingPickPromise ?: return
      pendingPickPromise = null

      if (resultCode != Activity.RESULT_OK || data?.data == null) {
        promise.resolve(null)
        return
      }

      val pickedUri = data.data!!
      ioExecutor.execute {
        try {
          val resolver = reactApplicationContext.contentResolver
          var displayName = "attachment"
          var byteSize: Long = -1L

          resolver.query(
              pickedUri,
              arrayOf(OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE),
              null,
              null,
              null,
          )?.use { cursor ->
            if (cursor.moveToFirst()) {
              val nameIdx = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
              if (nameIdx >= 0 && !cursor.isNull(nameIdx)) {
                displayName = cursor.getString(nameIdx) ?: "attachment"
              }
              val sizeIdx = cursor.getColumnIndex(OpenableColumns.SIZE)
              if (sizeIdx >= 0 && !cursor.isNull(sizeIdx)) {
                byteSize = cursor.getLong(sizeIdx)
              }
            }
          }

          val detectedMime = resolver.getType(pickedUri) ?: "application/octet-stream"

          val headerArray = Arguments.createArray()
          var countedBytes = 0L
          resolver.openInputStream(pickedUri)?.use { rawIn ->
            val headerBuf = ByteArray(32)
            val headerRead = rawIn.read(headerBuf)
            if (headerRead > 0) {
              for (i in 0 until headerRead) {
                headerArray.pushInt(headerBuf[i].toInt() and 0xFF)
              }
              countedBytes += headerRead.toLong()
            }
            if (byteSize < 0L) {
              val drain = ByteArray(16 * 1024)
              while (true) {
                val n = rawIn.read(drain)
                if (n <= 0) break
                countedBytes += n.toLong()
              }
              byteSize = countedBytes
            }
          } ?: run {
            promise.reject("ERR_FILE_READ", "Unable to open selected file stream.")
            return@execute
          }

          var imgWidth: Int? = null
          var imgHeight: Int? = null
          if (detectedMime.startsWith("image/")) {
            resolver.openInputStream(pickedUri)?.use { boundsStream ->
              val opts = BitmapFactory.Options().apply { inJustDecodeBounds = true }
              BitmapFactory.decodeStream(boundsStream, null, opts)
              if (opts.outWidth > 0 && opts.outHeight > 0) {
                imgWidth = opts.outWidth
                imgHeight = opts.outHeight
              }
            }
          }

          val result = Arguments.createMap().apply {
            putString("uri", pickedUri.toString())
            putString("fileName", displayName)
            putString("mimeType", detectedMime)
            putDouble("byteSize", byteSize.coerceAtLeast(0L).toDouble())
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
        } catch (err: Exception) {
          promise.reject("ERR_PICK_INSPECT", err.message ?: "Failed to inspect selected file.")
        }
      }
    }
  }

  init {
    reactContext.addActivityEventListener(activityEventListener)
  }

  override fun getName(): String = NAME

  override fun initialize() {
    super.initialize()
    try {
      val cm =
          reactApplicationContext.getSystemService(Context.CONNECTIVITY_SERVICE)
              as? ConnectivityManager
      if (cm != null) {
        val cb = object : ConnectivityManager.NetworkCallback() {
          override fun onAvailable(network: Network) {
            emitNetworkState(isCurrentlyOnline(cm))
          }

          override fun onLost(network: Network) {
            emitNetworkState(isCurrentlyOnline(cm))
          }

          override fun onCapabilitiesChanged(
              network: Network,
              networkCapabilities: NetworkCapabilities,
          ) {
            val online =
                networkCapabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
            emitNetworkState(online)
          }
        }
        cm.registerDefaultNetworkCallback(cb)
        networkCallback = cb
      }
    } catch (_: Exception) {
      // Safe fallback if network callback registration is restricted
    }
  }

  override fun invalidate() {
    super.invalidate()
    try {
      val cm =
          reactApplicationContext.getSystemService(Context.CONNECTIVITY_SERVICE)
              as? ConnectivityManager
      val cb = networkCallback
      if (cm != null && cb != null) {
        cm.unregisterNetworkCallback(cb)
      }
      networkCallback = null
    } catch (_: Exception) {
      // Ignore cleanup errors
    }
    for (flag in activeUploads.values) {
      flag.set(true)
    }
    activeUploads.clear()
  }

  private fun isCurrentlyOnline(cm: ConnectivityManager): Boolean {
    val active = cm.activeNetwork ?: return false
    val caps = cm.getNetworkCapabilities(active) ?: return false
    return caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
  }

  private fun emitNetworkState(isOnline: Boolean) {
    if (!reactApplicationContext.hasActiveReactInstance()) return
    val map = Arguments.createMap().apply {
      putBoolean("isOnline", isOnline)
    }
    reactApplicationContext
        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        .emit("asterialNetworkState", map)
  }

  private fun emitUploadProgress(
      uploadId: String,
      bytesSent: Long,
      totalBytes: Long,
  ) {
    if (!reactApplicationContext.hasActiveReactInstance()) return
    val percent =
        if (totalBytes > 0L) {
          ((bytesSent.toDouble() / totalBytes.toDouble()) * 100.0).coerceIn(0.0, 100.0)
        } else {
          0.0
        }
    val map = Arguments.createMap().apply {
      putString("uploadId", uploadId)
      putDouble("bytesSent", bytesSent.toDouble())
      putDouble("totalBytes", totalBytes.toDouble())
      putDouble("percent", percent)
    }
    reactApplicationContext
        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        .emit("asterialUploadProgress", map)
  }

  @ReactMethod
  fun addListener(eventName: String) {
    // Required for RN EventEmitter compatibility
  }

  @ReactMethod
  fun removeListeners(count: Double) {
    // Required for RN EventEmitter compatibility
  }

  @ReactMethod
  fun pickMediaOrDocument(options: ReadableMap, promise: Promise) {
    val activity = reactApplicationContext.currentActivity
    if (activity == null) {
      promise.reject("ERR_NO_ACTIVITY", "Foreground Android activity is unavailable.")
      return
    }
    if (pendingPickPromise != null) {
      promise.reject("ERR_PICK_IN_PROGRESS", "Another file selection is already open.")
      return
    }

    val kind = if (options.hasKey("kind")) options.getString("kind") ?: "attachment" else "attachment"
    val mimeTypes = if (kind == "avatar") AVATAR_MIME_TYPES else ATTACHMENT_MIME_TYPES

    val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
      addCategory(Intent.CATEGORY_OPENABLE)
      type = if (kind == "avatar") "image/*" else "*/*"
      putExtra(Intent.EXTRA_MIME_TYPES, mimeTypes)
      addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
    }

    pendingPickPromise = promise
    try {
      activity.startActivityForResult(intent, PICK_DOCUMENT_REQUEST)
    } catch (err: Exception) {
      pendingPickPromise = null
      promise.reject("ERR_PICK_LAUNCH", err.message ?: "Unable to open Android system file picker.")
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
    val expectedBytes =
        if (options.hasKey("totalBytes")) options.getDouble("totalBytes").toLong() else 0L

    if (uploadId.isBlank() || uriStr.isBlank() || uploadUrl.isBlank() || accessToken.isBlank()) {
      promise.reject("ERR_UPLOAD_ARGS", "Missing required upload parameters.")
      return
    }

    val cancelFlag = AtomicBoolean(false)
    activeUploads[uploadId] = cancelFlag

    ioExecutor.execute {
      var conn: HttpURLConnection? = null
      try {
        val parsedUri = Uri.parse(uriStr)
        val inputStream =
            reactApplicationContext.contentResolver.openInputStream(parsedUri)
                ?: run {
                  promise.reject("ERR_UPLOAD_STREAM", "Could not read local content URI.")
                  return@execute
                }

        conn = (URL(uploadUrl).openConnection() as HttpURLConnection).apply {
          requestMethod = "POST"
          doInput = true
          doOutput = true
          connectTimeout = 20_000
          readTimeout = 60_000
          setRequestProperty("Authorization", "Bearer $accessToken")
          if (anonKey.isNotBlank()) {
            setRequestProperty("apikey", anonKey)
          }
          setRequestProperty("Content-Type", mimeType)
          setRequestProperty("x-upsert", if (upsert) "true" else "false")
          if (expectedBytes > 0L) {
            setFixedLengthStreamingMode(expectedBytes)
          } else {
            setChunkedStreamingMode(16 * 1024)
          }
        }

        var sentBytes = 0L
        var lastEmitMs = 0L
        emitUploadProgress(uploadId, 0L, expectedBytes)

        BufferedInputStream(inputStream).use { bufferedIn ->
          conn.outputStream.use { out ->
            val chunk = ByteArray(16 * 1024)
            while (true) {
              if (cancelFlag.get()) {
                conn.disconnect()
                promise.reject("ERR_UPLOAD_CANCELLED", "Upload cancelled.")
                return@execute
              }
              val readCount = bufferedIn.read(chunk)
              if (readCount <= 0) break
              out.write(chunk, 0, readCount)
              sentBytes += readCount.toLong()

              val now = System.currentTimeMillis()
              if (now - lastEmitMs >= 80L || (expectedBytes > 0L && sentBytes >= expectedBytes)) {
                lastEmitMs = now
                emitUploadProgress(uploadId, sentBytes, expectedBytes.coerceAtLeast(sentBytes))
              }
            }
            out.flush()
          }
        }

        if (cancelFlag.get()) {
          conn.disconnect()
          promise.reject("ERR_UPLOAD_CANCELLED", "Upload cancelled.")
          return@execute
        }

        val status = conn.responseCode
        if (status in 200..299) {
          emitUploadProgress(uploadId, sentBytes, sentBytes.coerceAtLeast(expectedBytes))
          val res = Arguments.createMap().apply {
            putBoolean("ok", true)
            putInt("status", status)
            putDouble("bytesSent", sentBytes.toDouble())
          }
          promise.resolve(res)
        } else {
          val errBody = ByteArrayOutputStream()
          (conn.errorStream ?: conn.inputStream)?.use { errIn ->
            val buf = ByteArray(512)
            val len = errIn.read(buf)
            if (len > 0) errBody.write(buf, 0, len)
          }
          val msg = errBody.toString("UTF-8").take(220).ifBlank { "Storage upload failed (HTTP $status)." }
          promise.reject("ERR_UPLOAD_HTTP", msg)
        }
      } catch (err: Exception) {
        if (cancelFlag.get()) {
          promise.reject("ERR_UPLOAD_CANCELLED", "Upload cancelled.")
        } else {
          promise.reject("ERR_UPLOAD_NETWORK", err.message ?: "Network error during upload.")
        }
      } finally {
        activeUploads.remove(uploadId)
        conn?.disconnect()
      }
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
  fun copyText(text: String, promise: Promise) {
    UiThreadUtil.runOnUiThread {
      try {
        val clipboard =
            reactApplicationContext.getSystemService(Context.CLIPBOARD_SERVICE)
                as? ClipboardManager
        if (clipboard == null) {
          promise.reject("ERR_CLIPBOARD", "Clipboard service unavailable.")
          return@runOnUiThread
        }
        clipboard.setPrimaryClip(ClipData.newPlainText("ASTERIAL", text))
        promise.resolve(true)
      } catch (err: Exception) {
        promise.reject("ERR_CLIPBOARD", err.message ?: "Failed to copy text.")
      }
    }
  }

  @ReactMethod
  fun getNetworkState(promise: Promise) {
    try {
      val cm =
          reactApplicationContext.getSystemService(Context.CONNECTIVITY_SERVICE)
              as? ConnectivityManager
      val online = if (cm != null) isCurrentlyOnline(cm) else true
      val res = Arguments.createMap().apply {
        putBoolean("isOnline", online)
      }
      promise.resolve(res)
    } catch (_: Exception) {
      val res = Arguments.createMap().apply {
        putBoolean("isOnline", true)
      }
      promise.resolve(res)
    }
  }

  @ReactMethod
  fun getInstalledAppInfo(promise: Promise) {
    try {
      val ctx = reactApplicationContext
      val pm = ctx.packageManager
      val pkgName = ctx.packageName
      val pkgInfo =
          if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            pm.getPackageInfo(pkgName, PackageManager.PackageInfoFlags.of(0))
          } else {
            @Suppress("DEPRECATION")
            pm.getPackageInfo(pkgName, 0)
          }

      val versionName = pkgInfo.versionName ?: "1.3.0"
      val baseVersionName = versionName.removeSuffix("-debug")
      val versionCode =
          if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            pkgInfo.longVersionCode.toInt()
          } else {
            @Suppress("DEPRECATION")
            pkgInfo.versionCode
          }
      val isDebugBuild = (ctx.applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE) != 0

      val res = Arguments.createMap().apply {
        putString("applicationId", pkgName)
        putString("versionName", versionName)
        putString("baseVersionName", baseVersionName)
        putInt("versionCode", versionCode)
        putBoolean("isDebugBuild", isDebugBuild)
      }
      promise.resolve(res)
    } catch (err: Exception) {
      promise.reject("ERR_PACKAGE_INFO", err.message ?: "Unable to read package info.")
    }
  }
}
