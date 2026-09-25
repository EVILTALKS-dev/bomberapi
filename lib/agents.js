// language: JavaScript, file: lib/agents.js

// Real Android/iOS user-agents — the ones these OTP providers actually see.
// Rotated randomly per request. Mix of Indian-market apps + generic mobile.
export const USER_AGENTS = [
  // ---- okhttp (generic Android app base) ----
  "okhttp/4.9.2",
  "okhttp/4.10.0",
  "okhttp/4.12.0",
  "okhttp/5.0.0-alpha.2",

  // ---- Dalvik / Android WebView ----
  "Dalvik/2.1.0 (Linux; U; Android 13; SM-G991B Build/TP1A.220624.014)",
  "Dalvik/2.1.0 (Linux; U; Android 12; Redmi Note 11 Build/SP1A.210812.016)",
  "Dalvik/2.1.0 (Linux; U; Android 11; vivo 1906 Build/RP1A.200720.012)",
  "Dalvik/2.1.0 (Linux; U; Android 14; Pixel 8 Build/UQ1A.240205.004)",

  // ---- Chrome on Android (Hinglish locale) ----
  "Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.144 Mobile Safari/537.36",
  "Mozilla/5.0 (Linux; Android 12; Redmi Note 11) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.6045.194 Mobile Safari/537.36",
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.6167.101 Mobile Safari/537.36",

  // ---- iOS ----
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",

  // ---- desktop fallback (some endpoints only serve web) ----
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
];

export function pickUserAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

// ──────────────────────────────────────────────────────────────
// Add per-endpoint headers here if you reverse a specific app.
// Real apps send these; absent = 403 from their WAF.
// Example for Flipkart (uncomment & fill after APK reversal):
// ──────────────────────────────────────────────────────────────
export const APP_HEADERS = {
  // "Flipkart": {
  //   "x-app-version": "8.5.1",
  //   "x-api-key": "PASTE_FROM_APK",
  // },
  // "Zomato": {
  //   "x-zomato-app-version": "17.5.2",
  //   "x-zomato-api-key": "PASTE_FROM_APK",
  // },
};