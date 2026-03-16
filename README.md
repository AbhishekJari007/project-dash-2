diff --git a/README.md b/README.md
index dda645c80b2c39f822ee23edd2c8d931f24e7bb5..eb73419ac51dc7db123b79e4b99fe9b0920b47d1 100644
--- a/README.md
+++ b/README.md
@@ -1 +1,21 @@
-# project-dash-2
\ No newline at end of file
+# project-dash-2
+
+A futuristic iOS-style project dashboard web app with:
+
+- Login + role-based access (`admin/admin123` for edit, `viewer/viewer123` for read-only)
+- Project dashboard analytics with status and financial charts
+- Full project profile fields, finance metrics, phase management (up to 200), payment entries, and expense tracking
+- Delay alerts for projects/phases based on live dates
+- Per-phase measurement checkbox + file upload fields
+- Project-level document uploads
+- PDF export via browser print dialog
+- QR code generation with configurable visibility payload
+- WhatsApp quick-message launcher to client/engineer number
+
+## Run locally
+
+```bash
+python3 -m http.server 4173
+```
+
+Open `http://localhost:4173`.
