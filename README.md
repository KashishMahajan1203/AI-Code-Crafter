# 🤖 CodeCrafter AI

An **AI-powered Frontend Component Generator** built with **React, Vite, Node.js, Express, MongoDB and the OpenRouter AI API**, designed to create customizable UI components instantly.
This application converts **natural language prompts** into a single HTML/CSS/JS file or a full React + Vite (optionally Tailwind) project — and lets you **preview, edit, save, and export** them seamlessly.

[⚡ Experience the AI Component Forge!](https://codecrafterai.netlify.app/)

---

## 🚀 Features

### ✨ Smart Component Generation

* Describe the UI in plain English and pick a stack:

  * `HTML + CSS + JS`: a single self-contained HTML file
  * `React + Vite`: a complete, runnable React project
  * `React + Tailwind`: a React + Vite project with Tailwind CSS set up
* One-click example prompts (pricing table, glass login card, SaaS hero, analytics dashboard, testimonial carousel).
* Press `Ctrl + Enter` to generate, and cancel a request that is still running.
* If a model is rate-limited or returns broken output, the next model in the chain is tried automatically.
* Generated React projects are checked and repaired: missing boilerplate is added, the toolchain is pinned, package versions are checked against the npm registry, and one automatic AI fix pass corrects undefined variables or missing files.

### 🔄 Real-Time Preview

* Sandboxed live preview. React projects are compiled in the browser from the real files (Sucrase + esm.sh), with no build step.
* Desktop, tablet and mobile widths, a full-screen mode, and an option to open the preview in a new tab.

### 🧩 Code Editor & Export

* Built-in **Monaco Editor** with a file tree for browsing every generated file.
* Copy code with one click, download a single HTML file or the full project as a ZIP.
* Setup commands ready to copy (`npm install`, `npm run dev`).

### 🗂️ Project History

* Every generation is saved to your account in MongoDB.
* Search saved projects, reopen them, or delete them (with a confirmation step).

### 🔐 Accounts

* Email/password sign-up and sign-in, with JWT sessions that are revoked on the server when you log out.
* A landing page with a live prompt-to-component demo.

---

## Requirements

- Node.js 20 or newer
- MongoDB Atlas or a local MongoDB instance
- An OpenRouter API key (stored **only** in `server/.env`, never in the frontend)

---

## 🛠️ Tech Stack

**Frontend:** React 19 · Vite (Rolldown) · React Router 7 · Tailwind CSS · Monaco Editor · Sucrase · JSZip · React Icons · React Toastify

**Backend:** Node.js · Express 5 · MongoDB + Mongoose · JWT · bcrypt · Helmet · express-rate-limit · PM2

**AI:** OpenRouter (default models: Gemma 4 31B, Gemma 4 26B, Poolside Laguna; override with `OPENROUTER_MODELS`)

---

## 🔐 Security & Production Features

| Feature | Where |
| --- | --- |
| JWT authentication (HS256, issuer/audience checks, server-side revocation on logout) | `server/controllers/auth.controller.js`, `server/middleware/auth.middleware.js` |
| Password hashing with bcrypt (12 rounds, timing-safe login) | `server/controllers/auth.controller.js` |
| Input validation (type checks block NoSQL injection, size limits, path-traversal checks) | `server/middleware/validate.js` |
| Request size limit (2 MB JSON body → 413) | `server/app.js` |
| Rate limiting (global, auth brute-force, per-user AI quota) | `server/middleware/rateLimit.js` |
| CORS allow-list (comma-separated `FRONTEND_ORIGIN`) | `server/app.js` |
| Helmet security headers (strict CSP for the JSON API, HSTS) | `server/app.js` |
| HTTPS only (redirect + HSTS when `NODE_ENV=production`) | `server/middleware/security.js`, `client/public/_headers` |
| MongoDB indexes (`user + createdAt` compound, weighted text search) | `server/models/Project.js` |
| PM2 cluster mode with graceful reloads | `server/ecosystem.config.cjs` |
| Environment validation at startup + `.env.example` files | `server/config/env.js` |
| AI key and prompt templates kept server-side | `server/prompts/templates.js` |
| Model fallback chain (rate-limited / empty / broken output → next model) | `server/controllers/generation.controller.js` |
| Generated-project repair: missing boilerplate, pinned toolchain, npm-registry version check | `server/prompts/templates.js`, `server/prompts/verify.js` |
| Static check (undefined variables, missing components/files) + one automatic AI fix pass | `server/prompts/verify.js` |
| Live React preview compiled in the browser from the real files (Sucrase + esm.sh, sandboxed) | `client/src/lib/reactPreview.js` |

---

## 📂 Project Structure

```
📦 CodeCrafter-AI
 ┣ 📂 server  # Express API, MongoDB models, auth, generation, tests
 ┣ 📂 client  # React + Vite client (landing page, auth, studio)
 ┗ 📜 README.md
```

---

## Installation & Setup

```powershell
cd server
npm install
Copy-Item .env.example .env   # then fill in MONGODB_URI, JWT_SECRET, OPENROUTER_API_KEY

cd ../client
npm install
npm run dev:fullstack
```

Vite serves the UI on `http://localhost:5173` and proxies `/api` to the API on port `5000`.

Checks:

```powershell
npm --prefix ../server test   # API test suite (in-memory MongoDB, no real data touched)
npm run lint
npm run build
```

### Production

```powershell
# server (behind Nginx / a PaaS that terminates TLS)
$env:NODE_ENV="production"; npm --prefix server run pm2:start
```

Set `FRONTEND_ORIGIN` to your deployed frontend URL and, if the API is on another domain, set `VITE_API_URL` in `client/.env` before building. Note: rate-limit counters are in-memory per process, so in PM2 cluster mode each worker keeps its own count.

---

## 📸 Screenshots

### 🏠 Landing Page

Hero section with a live prompt-to-component demo.

![CodeCrafter landing page hero](https://res.cloudinary.com/dfacldueh/image/upload/v1791522547/Screenshot_2026-10-09_102336_plclkc.png)

### ✨ Features

Live preview, full React projects, Monaco editor, ZIP export, cloud history and server-side security.

![Features section of the landing page](https://res.cloudinary.com/dfacldueh/image/upload/v1791522547/Screenshot_2026-10-09_102350_exl8ko.png)

### 🛡️ Engineering & Call to Action

Production features (Helmet, CORS, HTTPS, MongoDB indexes, PM2 cluster) and the closing call to action.

![Engineering highlights and call to action](https://res.cloudinary.com/dfacldueh/image/upload/v1791522547/Screenshot_2026-10-09_102403_lavzbr.png)

### 🔐 Sign In & Sign Up

Email/password authentication with a single card for signing in or creating an account.

![Sign in and create account page](https://res.cloudinary.com/dfacldueh/image/upload/v1791522547/Screenshot_2026-10-09_102417_yjpcnl.png)

### ⚡ Studio — Live Preview

Pick a stack, describe the interface and see the generated component rendered instantly.

![Studio with prompt and live preview of a generated login card](https://res.cloudinary.com/dfacldueh/image/upload/v1791522548/Screenshot_2026-10-09_103725_o7bltu.png)

### 🗂️ Studio — Project Files & Editor

Browse every generated file in the built-in Monaco editor, with ready-to-copy setup commands.

![Generated React project files open in the code editor](https://res.cloudinary.com/dfacldueh/image/upload/v1791522548/Screenshot_2026-10-09_103711_aa3mzh.png)

---

## 📑 Future Enhancements

* 🧠 Let users choose the AI model for each generation
* 🌐 Export to CodeSandbox or StackBlitz
* 🧱 Component marketplace for sharing UIs
* ⚡ AI-based style consistency checks

---

## 📞 Contact

For queries or collaboration opportunities, reach out via:

* **Email:** [kashishmahajan878@gmail.com](kashishmahajan878@gmail.com)
* **LinkedIn:** [https://www.linkedin.com/in/kashish-mahajan-0591ba2b4/](https://www.linkedin.com/in/kashish-mahajan-0591ba2b4/)
* **GitHub:** [https://github.com/KashishMahajan1203](https://github.com/KashishMahajan1203)

---

*Developed with 💡 and passion by **Kashish Mahajan***
