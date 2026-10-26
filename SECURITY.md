# Security Policy & Privacy Architecture

## 🔒 Privacy & Architecture Principles

**LinkedIn Outreach Agent** is built strictly around **local privacy and ethical automation**:

1. **Zero Credential Sharing**:
   - The application **never** asks for, stores, or handles your LinkedIn email or password.
   - It communicates exclusively with your already-running, authenticated local Google Chrome session over a local WebSocket via Chrome DevTools Protocol (`127.0.0.1:9222`).
2. **Local-First Storage**:
   - All connection data, relevance scores, and message drafts are stored locally on your machine in an SQLite database (`outreach.db`).
   - Nothing is uploaded to external clouds or third-party servers unless you explicitly configure an optional OpenAI API key.
3. **Strict Human-in-the-Loop Safeguard**:
   - The application **never** automatically clicks "Send" or blasts unsolicited bulk messages.
   - It is designed solely as an intelligent copilot that discovers high-value people, helps prioritize whom to contact, generates thoughtful personalized drafts, and lets you review and send manually.

---

## 🛡️ Reporting a Vulnerability

If you discover a security vulnerability or sensitive data leak in this repository, please report it responsibly:

* Please **do not** report security vulnerabilities through public GitHub issues.
* Instead, email the maintainer directly or submit a private security advisory through GitHub.
* We will review and respond to reports within 48 hours.
