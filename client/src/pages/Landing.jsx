import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FaGithub, FaLinkedin, FaReact } from "react-icons/fa";
import {
  LuArrowRight,
  LuCode,
  LuDownload,
  LuEye,
  LuGauge,
  LuHistory,
  LuLock,
  LuShieldCheck,
  LuSparkles,
  LuZap,
} from "react-icons/lu";
import Brand from "../components/Brand";
import "../Landing.css";

const DEMO_PROMPT =
  "A pricing card with a highlighted Pro plan and a monthly / yearly toggle";

const FEATURES = [
  {
    icon: LuEye,
    title: "Live, responsive preview",
    text: "See the result instantly and switch between desktop, tablet and mobile widths — or go full screen.",
  },
  {
    icon: FaReact,
    title: "Full React projects",
    text: "Not just snippets: package.json, components, styles and setup commands for React + Vite or Tailwind.",
  },
  {
    icon: LuCode,
    title: "Monaco editor built in",
    text: "The same editor as VS Code. Tweak generated HTML and watch the preview update as you type.",
  },
  {
    icon: LuDownload,
    title: "One-click ZIP export",
    text: "Download a ready-to-run project folder. npm install, npm run dev, done.",
  },
  {
    icon: LuHistory,
    title: "Searchable cloud history",
    text: "Every generation is saved to your account in MongoDB, with full-text search across names and prompts.",
  },
  {
    icon: LuShieldCheck,
    title: "Secure by design",
    text: "The AI key never reaches the browser. Auth, validation and rate limits are enforced on the server.",
  },
];

const ENGINEERING = [
  ["JWT authentication", "Signed HS256 tokens with server-side revocation on logout"],
  ["bcrypt hashing", "12 salt rounds and timing-safe login responses"],
  ["Input validation", "Type-checked payloads that block NoSQL injection and path traversal"],
  ["Rate limiting", "Brute-force protection on auth, per-user quotas on AI generation"],
  ["Helmet + CORS", "Strict security headers and an allow-listed origin policy"],
  ["HTTPS only", "HSTS plus automatic HTTP → HTTPS redirect in production"],
  ["MongoDB indexes", "Compound owner/date index and a weighted text index"],
  ["PM2 cluster", "Multi-core process manager with graceful zero-downtime reloads"],
];

const STACK = ["React 19", "Vite", "Tailwind", "Node.js", "Express 5", "MongoDB", "Monaco", "OpenRouter"];

// Types the demo prompt once, then keeps the preview visible.
const useTypewriter = (text, speed = 38) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setCount(text.length);
      return;
    }

    if (count >= text.length) return;

    const timer = setTimeout(() => setCount((value) => value + 1), speed);
    return () => clearTimeout(timer);
  }, [count, text, speed]);

  return { typed: text.slice(0, count), done: count >= text.length };
};

const HeroDemo = () => {
  const { typed, done } = useTypewriter(DEMO_PROMPT);
  const [yearly, setYearly] = useState(false);

  return (
    <div className="demo-window" aria-hidden="true">
      <div className="demo-chrome">
        <i />
        <i />
        <i />
        <span>codecrafter.studio</span>
      </div>

      <div className="demo-body">
        <div className="demo-composer">
          <span className="demo-label">PROMPT</span>
          <p className="demo-prompt">
            {typed}
            <span className="demo-caret" />
          </p>
          <span className={`demo-generate ${done ? "is-ready" : ""}`}>
            <LuSparkles /> Generate
          </span>
        </div>

        <div className={`demo-preview ${done ? "is-visible" : ""}`}>
          <div className="demo-toggle">
            <button type="button" tabIndex={-1} className={!yearly ? "on" : ""} onClick={() => setYearly(false)}>
              Monthly
            </button>
            <button type="button" tabIndex={-1} className={yearly ? "on" : ""} onClick={() => setYearly(true)}>
              Yearly
            </button>
          </div>

          <div className="demo-cards">
            <div className="demo-card">
              <span>Starter</span>
              <strong>{yearly ? "$90" : "$9"}</strong>
              <em />
              <em />
            </div>
            <div className="demo-card is-pro">
              <span>Pro</span>
              <strong>{yearly ? "$290" : "$29"}</strong>
              <em />
              <em />
              <b>Most popular</b>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const Landing = ({ user }) => {
  const ctaTarget = user ? "/studio" : "/auth";
  const ctaLabel = user ? "Open studio" : "Start building — free";

  return (
    <div className="landing">
      <div className="landing-glow" aria-hidden="true" />

      <header className="landing-nav">
        <Brand />

        <nav aria-label="Primary">
          <a href="#features">Features</a>
          <a href="#engineering">Engineering</a>
          <a href="https://github.com/KashishMahajan1203" target="_blank" rel="noreferrer">
            GitHub
          </a>
        </nav>

        <Link className="nav-cta" to={ctaTarget}>
          {user ? "Open studio" : "Sign in"} <LuArrowRight />
        </Link>
      </header>

      <main>
        <section className="hero">
          <div className="hero-copy">
            <div className="section-kicker">
              <span className="kicker-mark" />
              AI COMPONENT STUDIO
            </div>

            <h1>
              Turn a sentence
              <br />
              into a <span>shipped interface.</span>
            </h1>

            <p>
              CodeCrafter turns plain-English prompts into production-ready
              HTML or full React projects — with a live preview, an editor and
              one-click export.
            </p>

            <div className="hero-actions">
              <Link className="primary-cta" to={ctaTarget}>
                {ctaLabel} <LuArrowRight />
              </Link>
              <a className="secondary-cta" href="#features">
                See what it does
              </a>
            </div>

            <ul className="hero-stats">
              <li>
                <LuZap /> <strong>3</strong> stacks
              </li>
              <li>
                <LuGauge /> <strong>&lt;60s</strong> to preview
              </li>
              <li>
                <LuLock /> <strong>0</strong> keys in the browser
              </li>
            </ul>
          </div>

          <HeroDemo />
        </section>

        <section className="stack-strip" aria-label="Built with">
          {STACK.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </section>

        <section className="landing-section" id="features">
          <div className="section-heading">
            <div className="section-kicker">
              <span className="kicker-mark" />
              FEATURES
            </div>
            <h2>Everything between idea and code.</h2>
          </div>

          <div className="feature-grid">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <article className="feature-card" key={title}>
                <span className="feature-icon">
                  <Icon />
                </span>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="landing-section" id="how">
          <div className="section-heading">
            <div className="section-kicker">
              <span className="kicker-mark" />
              HOW IT WORKS
            </div>
            <h2>Three steps. No boilerplate.</h2>
          </div>

          <ol className="steps">
            <li>
              <span>01</span>
              <h3>Pick a stack</h3>
              <p>Plain HTML/CSS/JS, React + Vite, or React with Tailwind.</p>
            </li>
            <li>
              <span>02</span>
              <h3>Describe the UI</h3>
              <p>Write it like you'd brief a designer. Layout, style, behaviour.</p>
            </li>
            <li>
              <span>03</span>
              <h3>Preview & export</h3>
              <p>Check every breakpoint, tweak the code, download the project.</p>
            </li>
          </ol>
        </section>

        <section className="landing-section" id="engineering">
          <div className="section-heading">
            <div className="section-kicker">
              <span className="kicker-mark" />
              UNDER THE HOOD
            </div>
            <h2>Production-grade, not a demo.</h2>
            <p>
              A Node/Express API with MongoDB, hardened the way a real product
              should be — and covered by an automated test suite.
            </p>
          </div>

          <div className="engineering-grid">
            {ENGINEERING.map(([title, text]) => (
              <div className="engineering-item" key={title}>
                <LuShieldCheck aria-hidden="true" />
                <div>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="cta-band">
          <h2>Your next component is one sentence away.</h2>
          <Link className="primary-cta" to={ctaTarget}>
            {ctaLabel} <LuArrowRight />
          </Link>
        </section>
      </main>

      <footer className="landing-footer">
        <span>
          Designed & built by <strong>Kashish Mahajan</strong>
        </span>
        <span className="footer-links">
          <a href="https://github.com/KashishMahajan1203" target="_blank" rel="noreferrer" aria-label="GitHub">
            <FaGithub />
          </a>
          <a href="https://www.linkedin.com/in/kashish-mahajan-0591ba2b4/" target="_blank" rel="noreferrer" aria-label="LinkedIn">
            <FaLinkedin />
          </a>
        </span>
      </footer>
    </div>
  );
};

export default Landing;
