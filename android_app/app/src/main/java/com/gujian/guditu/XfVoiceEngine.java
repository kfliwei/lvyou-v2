package com.gujian.guditu;

import android.content.Context;
import android.os.Bundle;
import android.util.Log;

import com.iflytek.cloud.InitListener;
import com.iflytek.cloud.RecognizerListener;
import com.iflytek.cloud.RecognizerResult;
import com.iflytek.cloud.SpeechConstant;
import com.iflytek.cloud.SpeechError;
import com.iflytek.cloud.SpeechRecognizer;
import com.iflytek.cloud.SpeechUtility;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * 讯飞语音听写引擎（国内直连，主引擎）
 * JS 桥保持与 Google 引擎一致的语义：onStart / onPartial / onResult / onError
 */
public class XfVoiceEngine {

    private static final String TAG = "GuJianVoice";
    private static final String APPID = "546224f8";

    private SpeechRecognizer xf;
    private boolean ready = false;
    private boolean listening = false;
    private StringBuilder sb = new StringBuilder();
    private Callback cb;
    /** 停顿结束（后端点）毫秒，可由设置动态调整，默认 5000 */
    public volatile int vadEos = 5000;

    public interface Callback {
        void onStart();
        void onPartial(String text);
        void onResult(String text);
        void onError(String code);
    }

    public XfVoiceEngine(Context ctx, Callback cb) {
        this.cb = cb;
        try {
            // 讯飞初始化（线程安全，可重复调用）
            SpeechUtility.createUtility(ctx, SpeechConstant.APPID + "=" + APPID);
            xf = SpeechRecognizer.createRecognizer(ctx, new InitListener() {
                @Override
                public void onInit(int code) {
                    ready = (code == 0);
                    Log.d(TAG, "Xf init code=" + code + " ready=" + ready);
                }
            });
        } catch (Throwable t) {
            Log.e(TAG, "Xf engine create fail: " + t);
            ready = false;
        }
    }

    public boolean isReady() { return ready; }

    public void start() {
        if (xf == null || listening) return;
        try {
            sb.setLength(0);
            xf.setParameter(SpeechConstant.DOMAIN, "iat");
            xf.setParameter(SpeechConstant.LANGUAGE, "zh_cn");
            xf.setParameter(SpeechConstant.ACCENT, "mandarin");
            xf.setParameter(SpeechConstant.VAD_BOS, "4000");
            xf.setParameter(SpeechConstant.VAD_EOS, String.valueOf(vadEos));
            xf.setParameter(SpeechConstant.NET_TIMEOUT, "10000");
            listening = true;
            int ret = xf.startListening(listener);
            Log.d(TAG, "Xf startListening ret=" + ret);
            if (ret != 0) { listening = false; cb.onError("start_fail"); }
        } catch (Throwable t) {
            listening = false;
            Log.e(TAG, "Xf start exception: " + t);
            cb.onError("start_fail");
        }
    }

    public void cancel() {
        listening = false;
        if (xf != null) { try { xf.cancel(); } catch (Throwable ignored) {} }
    }

    public void destroy() {
        listening = false;
        if (xf != null) { try { xf.cancel(); xf.destroy(); } catch (Throwable ignored) {} xf = null; }
    }

    private final RecognizerListener listener = new RecognizerListener() {
        @Override public void onBeginOfSpeech() { if (cb != null) cb.onStart(); }

        @Override
        public void onResult(RecognizerResult result, boolean isLast) {
            try {
                String text = parse(result.getResultString());
                if (text != null && !text.isEmpty()) {
                    sb.append(text);
                    if (cb != null) cb.onPartial(sb.toString());
                }
            } catch (Throwable t) {
                Log.e(TAG, "Xf parse fail: " + t);
            }
            if (isLast) {
                listening = false;
                String full = sb.toString().trim();
                if (cb != null) cb.onResult(full.isEmpty() ? null : full);
            }
        }

        @Override
        public void onError(SpeechError error) {
            listening = false;
            int code = error.getErrorCode();
            Log.d(TAG, "Xf onError code=" + code);
            if (cb != null) cb.onError("xf_" + code);
        }

        @Override public void onEndOfSpeech() {}
        @Override public void onVolumeChanged(int volume, byte[] data) {}
        @Override public void onEvent(int eventType, int arg1, int arg2, Bundle obj) {}
    };

    /** 解析讯飞 iat 返回 JSON：{"ws":[{"cw":[{"w":"你"}]}]} */
    private String parse(String json) {
        try {
            JSONObject root = new JSONObject(json);
            if (root.optInt("sn", -1) == 0) sb.setLength(0);
            JSONArray ws = root.optJSONArray("ws");
            if (ws == null) return null;
            StringBuilder line = new StringBuilder();
            for (int i = 0; i < ws.length(); i++) {
                JSONArray cw = ws.optJSONObject(i).optJSONArray("cw");
                if (cw != null && cw.length() > 0) line.append(cw.optJSONObject(0).optString("w"));
            }
            return line.toString();
        } catch (Throwable t) {
            return null;
        }
    }
}
