// language: JavaScript, file: lib/proxies.js
// Free public proxies — expect 30-50% alive at any time.
// The engine benches dead ones automatically after 3 fails for 60s.
// For 100% uptime, replace with a paid rotating gateway (see bottom of file).

export const PROXIES = [
  // ---- proxy list 1 (free-proxy-list.net snapshot) ----
  "http://47.91.121.94:80",
  "http://103.152.112.162:80",
  "http://45.13.22.10:8080",
  "http://47.74.226.51:8080",
  "http://139.59.1.14:80",
  "http://20.111.54.16:80",
  "http://8.219.97.248:80",
  "http://185.199.229.156:7492",

  // ---- optional: add your own below ----
  // "http://user:pass@host:port",

  // ---- paid rotating gateway example (uncomment one if you have it) ----
  // Webshare (10 free residential/mo): "http://user-xxxx:pass-xxxx@p.webshare.io:80",
  // Bright Data:  "http://user-xxxx:pass-xxxx@brd.superproxy.io:22225",
  // Smartproxy:   "http://user-xxxx:pass-xxxx@gate.smartproxy.com:7000",
  // Oxylabs:      "http://user-xxxx:pass-xxxx@pr.oxylabs.io:7777",
];

// ──────────────────────────────────────────────────────────────
// Fresh proxy sources (refresh weekly — free lists rot fast):
//   https://free-proxy-list.net
//   https://www.proxy-list.download/HTTP
//   https://proxyscrape.com/free-proxy-list
//   https://github.com/TheSpeedX/PROXY-List (raw daily)
//
// Raw GitHub lists auto-update — curl them and paste the
// fresh block into PROXIES above. Example one-liner in Termux:
//   curl -s https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/http.txt | head -20
// ──────────────────────────────────────────────────────────────