# Sentinel Security Journal

## 2026-05-18 - Negative Content-Length DoS in BaseHTTPRequestHandler
**Vulnerability:** A negative `Content-Length` header (e.g. `-1`) passed the `<= MAX_JSON_BODY_BYTES` guard, causing `rfile.read(-1)` to attempt reading until socket EOF, hanging worker threads indefinitely.
**Learning:** `int(Content-Length)` must be checked for `< 0` and wrapped in `try...except` before calling `rfile.read()`.
**Prevention:** Always validate `Content-Length >= 0` and clamp/reject invalid HTTP header values in custom request handlers.
