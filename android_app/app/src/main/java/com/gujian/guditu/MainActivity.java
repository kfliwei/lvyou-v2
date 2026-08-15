package com.gujian.guditu;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.media.MediaRecorder;
import android.net.Uri;
import android.os.Bundle;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.util.Base64;
import android.util.Log;
import android.webkit.GeolocationPermissions;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.File;
import java.io.FileInputStream;
import java.util.ArrayList;
import java.util.Locale;

public class MainActivity extends Activity {

    private static final String TAG = "GuJianVoice";
    private static final int LOC_PERM = 1001;
    private static final int VOICE_PERM = 1002;
    private WebView webView;
    private SpeechRecognizer recognizer;
    private XfVoiceEngine xfEngine;
    private boolean voiceBusy = false;
    private MediaRecorder recorder;
    private File audioFile;
    /** 设置：是否保留录音（默认开） */
    private boolean keepAudio = true;
    private static final int FILE_CHOOSER = 2001;
    private android.webkit.ValueCallback<Uri[]> fileCallback;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        webView = findViewById(R.id.webview);
        WebSettings ws = webView.getSettings();
        ws.setJavaScriptEnabled(true);
        ws.setDomStorageEnabled(true);
        ws.setGeolocationEnabled(true);
        ws.setAllowFileAccess(true);
        ws.setAllowFileAccessFromFileURLs(true); // SPA 路由：file:// 页面可 fetch 同目录片段
        ws.setAllowContentAccess(true);
        // 让 WebView 严格遵循页面 viewport（width=device-width）自适应，
        // 而非按宽视口渲染再缩放（后者会导致 UI 组件偏大、不自适应）
        ws.setLoadWithOverviewMode(false);
        ws.setUseWideViewPort(false);
        // 允许 file:// 页面加载 https 地图瓦片
        ws.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        // 关闭缓存：assets 更新后每次启动强制加载最新版（避免旧 JS/CSS 残留）
        ws.setCacheMode(WebSettings.LOAD_DEFAULT);
        webView.clearCache(true);
        // 追加自定义 UA 标记，供网页识别"是否运行在 App 内"（用于直接拉起高德深链）
        ws.setUserAgentString(ws.getUserAgentString() + " GuJianApp");

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                // 高德导航/标记链接：甩给系统，调起高德 App（或网页版）
                if (url.contains("amap") || url.startsWith("amapuri://") || url.contains("uri.amap.com")) {
                    try {
                        Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                        startActivity(i);
                        return true;
                    } catch (Exception e) {
                        return false;
                    }
                }
                return false;
            }
        });
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
                // 自动授权定位（应用已声明并在运行时申请了定位权限）
                callback.invoke(origin, true, true);
            }
            @Override
            public boolean onShowFileChooser(WebView wv, android.webkit.ValueCallback<Uri[]> callback, FileChooserParams params) {
                // 支持页面内 <input type=file> 选择照片
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                Intent intent = params.createIntent();
                try {
                    startActivityForResult(intent, FILE_CHOOSER);
                } catch (Exception e) {
                    fileCallback = null;
                    return false;
                }
                return true;
            }
        });

        // 运行时申请定位 + 录音权限
        if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED
                || checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{
                    Manifest.permission.ACCESS_FINE_LOCATION,
                    Manifest.permission.ACCESS_COARSE_LOCATION,
                    Manifest.permission.RECORD_AUDIO
            }, LOC_PERM);
        }

        // 语音桥：页面通过 window.AndroidVoice.startVoice() 调用
        webView.addJavascriptInterface(new AndroidVoice(), "AndroidVoice");

        // 讯飞引擎（主）：国内直连；初始化异步，ready 前自动回退 Google
        xfEngine = new XfVoiceEngine(this, new XfVoiceEngine.Callback() {
            @Override public void onStart() { voiceBusy = true; jsCall("window.__tnOnVoiceStart&&__tnOnVoiceStart()"); }
            @Override public void onPartial(String t) { jsCall("window.__tnOnVoicePartial&&__tnOnVoicePartial(" + jsStr(t) + ")"); }
            @Override public void onResult(String t) {
                voiceBusy = false;
                stopRecorderAndSend();
                if (t != null && !t.isEmpty()) jsCall("window.__tnOnVoiceResult&&__tnOnVoiceResult(" + jsStr(t) + ")");
                else jsCall("window.__tnOnVoiceError&&__tnOnVoiceError('no_result')");
            }
            @Override public void onError(String code) {
                voiceBusy = false;
                stopRecorderAndSend();
                jsCall("window.__tnOnVoiceError&&__tnOnVoiceError('" + code + "')");
            }
        });

        webView.loadUrl("file:///android_asset/index.html");
    }

    /** 语音识别桥：页面调用 startVoice()，结果通过 window.__tnOnVoice* 回调注入页面 */
    private void startRecorder() {
        if (!keepAudio) return;   // 设置里关闭「保留录音」则不录
        try {
            audioFile = new File(getCacheDir(), "voice_" + System.currentTimeMillis() + ".m4a");
            recorder = new MediaRecorder();
            recorder.setAudioSource(MediaRecorder.AudioSource.MIC);
            recorder.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4);
            recorder.setAudioEncoder(MediaRecorder.AudioEncoder.AAC);
            recorder.setAudioEncodingBitRate(64000);
            recorder.setAudioSamplingRate(16000);
            recorder.setOutputFile(audioFile.getAbsolutePath());
            recorder.prepare();
            recorder.start();
        } catch (Exception e) {
            recorder = null;
            audioFile = null;
        }
    }
    private void stopRecorderAndSend() {
        if (recorder != null) {
            try { recorder.stop(); } catch (Exception ignored) {}
            try { recorder.release(); } catch (Exception ignored) {}
            recorder = null;
        }
        if (audioFile != null && audioFile.exists() && audioFile.length() > 0) {
            try {
                FileInputStream fis = new FileInputStream(audioFile);
                byte[] data = new byte[(int) audioFile.length()];
                int off = 0;
                while (off < data.length) { int n = fis.read(data, off, data.length - off); if (n <= 0) break; off += n; }
                fis.close();
                String b64 = Base64.encodeToString(data, Base64.NO_WRAP);
                jsCall("window.__tnOnVoiceAudio&&__tnOnVoiceAudio('data:audio/mp4;base64," + b64 + "')");
            } catch (Exception e) {}
            try { audioFile.delete(); } catch (Exception ignored) {}
            audioFile = null;
        }
    }
    private class AndroidVoice {
        @JavascriptInterface
        public boolean isVoiceSupported() {
            if (xfEngine != null && xfEngine.isReady()) return true;
            boolean ok = SpeechRecognizer.isRecognitionAvailable(MainActivity.this);
            Log.d(TAG, "isVoiceSupported(xf=" + (xfEngine != null && xfEngine.isReady()) + ",google=" + ok + ")");
            return ok;
        }

        @JavascriptInterface
        public void startVoice() {
            Log.d(TAG, "startVoice called, busy=" + voiceBusy + ", xfReady=" + (xfEngine != null && xfEngine.isReady()));
            runOnUiThread(() -> {
                if (voiceBusy) { Log.d(TAG, "busy, ignore"); return; }
                if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
                    Log.d(TAG, "no RECORD_AUDIO permission");
                    requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, VOICE_PERM);
                    jsCall("window.__tnOnVoiceError&&__tnOnVoiceError('no_perm')");
                    return;
                }
                // 主引擎：讯飞（国内直连）；未就绪回退 Google
                startRecorder();
                if (xfEngine != null && xfEngine.isReady()) {
                    xfEngine.start();
                    return;
                }
                try {
                    if (recognizer == null) {
                        recognizer = SpeechRecognizer.createSpeechRecognizer(MainActivity.this);
                        recognizer.setRecognitionListener(listener);
                        Log.d(TAG, "google recognizer created");
                    }
                    Intent it = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
                    it.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
                    try { it.putExtra(RecognizerIntent.EXTRA_LANGUAGE, Locale.getDefault().toLanguageTag()); } catch (Exception ignored) {}
                    it.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
                    it.putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, getPackageName());
                    it.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
                    voiceBusy = true;
                    recognizer.startListening(it);
                    Log.d(TAG, "google startListening OK");
                    jsCall("window.__tnOnVoiceStart&&__tnOnVoiceStart()");
                } catch (Exception e) {
                    voiceBusy = false;
                    Log.d(TAG, "google startVoice exception: " + e);
                    jsCall("window.__tnOnVoiceError&&__tnOnVoiceError('start_fail')");
                }
            });
        }

        @JavascriptInterface
        public void cancelVoice() {
            runOnUiThread(() -> {
                voiceBusy = false;
                stopRecorderAndSend();
                if (xfEngine != null) xfEngine.cancel();
                if (recognizer != null) {
                    try { recognizer.cancel(); } catch (Exception ignored) {}
                }
            });
        }

        @JavascriptInterface
        public void setKeepAudio(boolean keep) {
            keepAudio = keep;
        }

        @JavascriptInterface
        public void setVad(int ms) {
            if (ms >= 1000 && ms <= 10000) {
                if (xfEngine != null) xfEngine.vadEos = ms;
                Log.d(TAG, "VAD_EOS set to " + ms);
            }
        }

        @JavascriptInterface
        public void saveImage(String name, String dataUrl) {
            // 保存图片（base64 dataUrl）到系统下载目录
            try {
                String b64 = dataUrl;
                if (b64.startsWith("data:image/")) b64 = b64.substring(b64.indexOf(",") + 1);
                byte[] img = Base64.decode(b64, Base64.DEFAULT);
                java.io.OutputStream os = null;
                if (android.os.Build.VERSION.SDK_INT >= 29) {
                    android.content.ContentValues cv = new android.content.ContentValues();
                    cv.put(android.provider.MediaStore.Downloads.DISPLAY_NAME, name);
                    cv.put(android.provider.MediaStore.Downloads.MIME_TYPE, "image/png");
                    android.net.Uri uri = getContentResolver().insert(android.provider.MediaStore.Downloads.EXTERNAL_CONTENT_URI, cv);
                    os = getContentResolver().openOutputStream(uri);
                } else {
                    java.io.File dir = android.os.Environment.getExternalStoragePublicDirectory(android.os.Environment.DIRECTORY_DOWNLOADS);
                    java.io.File f = new java.io.File(dir, name);
                    os = new java.io.FileOutputStream(f);
                }
                if (os != null) { os.write(img); os.close(); }
                jsCall("window.__tnImgSaved&&__tnImgSaved('" + name + "')");
            } catch (Exception e) {
                jsCall("window.__tnImgSaved&&__tnImgSaved('err')");
            }
        }

        @JavascriptInterface
        public void savePhotoFile(String name, String dataUrl) {
            // 游记照片：base64 dataUrl 存到 App 私有 files 目录，返回 file:// 绝对路径供 <img> 直接显示
            // （私有目录无需存储权限；WebView 可读 file:// 路径。旧照片从备份导入时 base64 仍可用。）
            try {
                String b64 = dataUrl;
                if (b64.startsWith("data:")) b64 = b64.substring(b64.indexOf(",") + 1);
                byte[] img = Base64.decode(b64, Base64.DEFAULT);
                java.io.File dir = new java.io.File(getFilesDir(), "photos");
                if (!dir.exists()) dir.mkdirs();
                java.io.File f = new java.io.File(dir, name);
                java.io.OutputStream os = new java.io.FileOutputStream(f);
                os.write(img); os.close();
                jsCall("window.__tnPhotoSaved&&__tnPhotoSaved('file://" + f.getAbsolutePath() + "')");
            } catch (Exception e) {
                jsCall("window.__tnPhotoSaved&&__tnPhotoSaved('err')");
            }
        }

        @JavascriptInterface
        public void saveAudioFile(String name, String dataUrl) {
            // 游记录音：base64 存到 App 私有 files 目录，返回 file:// 路径（<audio> 可直接播放）
            try {
                String b64 = dataUrl;
                if (b64.startsWith("data:")) b64 = b64.substring(b64.indexOf(",") + 1);
                byte[] data = Base64.decode(b64, Base64.DEFAULT);
                java.io.File dir = new java.io.File(getFilesDir(), "audio");
                if (!dir.exists()) dir.mkdirs();
                java.io.File f = new java.io.File(dir, name);
                java.io.OutputStream os = new java.io.FileOutputStream(f);
                os.write(data); os.close();
                jsCall("window.__tnAudioSaved&&__tnAudioSaved('file://" + f.getAbsolutePath() + "')");
            } catch (Exception e) {
                jsCall("window.__tnAudioSaved&&__tnAudioSaved('err')");
            }
        }

        @JavascriptInterface
        public void saveTextFile(String name, String content) {
            // 导出文档：保存到系统下载目录
            try {
                java.io.OutputStream os = null;
                if (android.os.Build.VERSION.SDK_INT >= 29) {
                    android.content.ContentValues cv = new android.content.ContentValues();
                    cv.put(android.provider.MediaStore.Downloads.DISPLAY_NAME, name);
                    cv.put(android.provider.MediaStore.Downloads.MIME_TYPE, "text/html");
                    android.net.Uri uri = getContentResolver().insert(android.provider.MediaStore.Downloads.EXTERNAL_CONTENT_URI, cv);
                    os = getContentResolver().openOutputStream(uri);
                } else {
                    if (checkSelfPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
                        requestPermissions(new String[]{Manifest.permission.WRITE_EXTERNAL_STORAGE}, 1003);
                        jsCall("window.__tnSaveDone&&__tnSaveDone('need_perm')");
                        return;
                    }
                    java.io.File dir = android.os.Environment.getExternalStoragePublicDirectory(android.os.Environment.DIRECTORY_DOWNLOADS);
                    java.io.File f = new java.io.File(dir, name);
                    os = new java.io.FileOutputStream(f);
                }
                if (os != null) {
                    os.write(content.getBytes("UTF-8"));
                    os.close();
                }
                jsCall("window.__tnSaveDone&&__tnSaveDone('" + name + "')");
            } catch (Exception e) {
                jsCall("window.__tnSaveDone&&__tnSaveDone('err')");
            }
        }
    }

    private final RecognitionListener listener = new RecognitionListener() {
        @Override public void onReadyForSpeech(Bundle params) { Log.d(TAG, "onReadyForSpeech"); }
        @Override public void onBeginningOfSpeech() { Log.d(TAG, "onBeginningOfSpeech"); }
        @Override public void onRmsChanged(float rmsdB) {}
        @Override public void onBufferReceived(byte[] buffer) {}

        @Override
        public void onPartialResults(Bundle partialResults) {
            ArrayList<String> list = partialResults.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
            if (list != null && !list.isEmpty()) {
                jsCall("window.__tnOnVoicePartial&&__tnOnVoicePartial(" + jsStr(list.get(0)) + ")");
            }
        }

        @Override
        public void onResults(Bundle results) {
            voiceBusy = false;
            stopRecorderAndSend();
            ArrayList<String> list = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
            if (list != null && !list.isEmpty()) {
                Log.d(TAG, "onResults: " + list.get(0));
                jsCall("window.__tnOnVoiceResult&&__tnOnVoiceResult(" + jsStr(list.get(0)) + ")");
            } else {
                Log.d(TAG, "onResults empty");
                jsCall("window.__tnOnVoiceError&&__tnOnVoiceError('no_result')");
            }
        }

        @Override public void onError(int error) {
            voiceBusy = false;
            stopRecorderAndSend();
            Log.d(TAG, "onError: " + error);
            jsCall("window.__tnOnVoiceError&&__tnOnVoiceError('" + errText(error) + "')");
        }
        @Override public void onEndOfSpeech() {}
        @Override public void onEvent(int eventType, Bundle params) {}
    };

    private String errText(int e) {
        switch (e) {
            case SpeechRecognizer.ERROR_NO_MATCH: return "no_match";
            case SpeechRecognizer.ERROR_SPEECH_TIMEOUT: return "timeout";
            case SpeechRecognizer.ERROR_NETWORK: return "network";
            case SpeechRecognizer.ERROR_NETWORK_TIMEOUT: return "network_timeout";
            case SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS: return "no_perm";
            case SpeechRecognizer.ERROR_RECOGNIZER_BUSY: return "busy";
            default: return "err_" + e;
        }
    }

    private void jsCall(String js) {
        Log.d(TAG, "jsCall: " + js.substring(0, Math.min(60, js.length())));
        runOnUiThread(() -> {
            if (webView != null) webView.evaluateJavascript(js, null);
        });
    }

    private static String jsStr(String s) {
        if (s == null) return "\"\"";
        String r = s.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n").replace("\r", "");
        return "\"" + r + "\"";
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == FILE_CHOOSER) {
            if (fileCallback != null) {
                Uri[] results = null;
                if (resultCode == RESULT_OK && data != null) {
                    if (data.getClipData() != null) {
                        int n = data.getClipData().getItemCount();
                        results = new Uri[n];
                        for (int i = 0; i < n; i++) results[i] = data.getClipData().getItemAt(i).getUri();
                    } else if (data.getData() != null) {
                        results = new Uri[]{data.getData()};
                    }
                }
                fileCallback.onReceiveValue(results);
                fileCallback = null;
            }
        }
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (xfEngine != null) { xfEngine.destroy(); xfEngine = null; }
        if (recognizer != null) {
            try { recognizer.destroy(); } catch (Exception ignored) {}
            recognizer = null;
        }
    }
}
