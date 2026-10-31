# Contributing to LinkedIn Outreach Agent

Thank you for your interest in contributing to **LinkedIn Outreach Agent**! We welcome contributions from developers, designers, prompt engineers, and open-source enthusiasts.

---

## 🧭 Code of Conduct

By participating in this project, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md). Please be kind, respectful, and constructive in all interactions.

---

## 🛠️ How to Get Started

1. **Fork the repository** on GitHub.
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/linkdin-outreach.git
   cd linkdin-outreach
   ```
3. **Install dependencies**:
   ```bash
   npm install
   ```
4. **Copy `.env.example` to `.env`**:
   ```bash
   cp .env.example .env
   ```
5. **Start the development server**:
   ```bash
   npm run dev
   ```

---

## 🌿 Branching Strategy

- `main`: Production-ready, stable releases.
- Feature branches: `feature/your-feature-name`
- Bug fix branches: `fix/your-bug-fix`

---

## 🔒 Crucial Rules & Security Standards

1. **Never Commit Personal Data**:
   - Never commit `outreach.db`, `*.csv`, or raw LinkedIn profile dumps.
   - All personal databases and CSVs are ignored in `.gitignore`.
2. **Strict Human-in-the-Loop Constraint**:
   - We **never** implement automated message sending on LinkedIn.
   - The tool only extracts visible profile data, scores relevance, generates drafts, and provides 1-click clipboard copy or staging into the active draft box.
3. **Code Style**:
   - Clean, modular JavaScript (ES Modules).
   - Descriptive variable names, small single-responsibility functions.
   - Semantic HTML and modern Vanilla CSS (no heavy CSS frameworks unless approved).

---

## 📬 Submitting a Pull Request (PR)

1. Ensure your changes run without console errors.
2. Commit your changes with a clear, concise commit message:
   ```bash
   git commit -m "feat: add keyword filter for deep tech recruiters"
   ```
3. Push to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```
4. Open a Pull Request against the `main` branch. Describe:
   - What problem your PR solves
   - How to test and verify your changes

Thank you for helping make connection outreach smarter and more authentic!
