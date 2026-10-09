import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import request from "supertest";
import { MongoMemoryServer } from "mongodb-memory-server";

process.env.JWT_SECRET = "test-secret-that-is-definitely-longer-than-32-chars";
process.env.MONGODB_URI = "placeholder";
delete process.env.OPENROUTER_API_KEY;

const { default: createApp } = await import("../app.js");
const { loadConfig } = await import("../config/env.js");
const { default: Project } = await import("../models/Project.js");
const { default: User } = await import("../models/User.js");

let mongo;
let app;

const signUp = (body) =>
  request(app).post("/api/auth/signup").send(body);

const validUser = (n) => ({
  name: `User ${n}`,
  email: `user${n}@example.com`,
  password: "secret123",
});

before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await Promise.all([User.createIndexes(), Project.createIndexes()]);
  app = createApp(loadConfig());
});

after(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});

describe("security headers & CORS", () => {
  test("helmet headers are set and x-powered-by is hidden", async () => {
    const res = await request(app).get("/api/health");
    assert.equal(res.status, 200);
    assert.equal(res.headers["x-content-type-options"], "nosniff");
    assert.equal(res.headers["x-frame-options"], "SAMEORIGIN");
    assert.match(res.headers["content-security-policy"], /default-src 'none'/);
    assert.equal(res.headers["x-powered-by"], undefined);
  });

  test("allowed origin gets CORS headers, unknown origin does not", async () => {
    const ok = await request(app).get("/api/health").set("Origin", "http://localhost:5173");
    assert.equal(ok.headers["access-control-allow-origin"], "http://localhost:5173");
    assert.equal(ok.headers["access-control-allow-credentials"], "true");

    const bad = await request(app).get("/api/health").set("Origin", "https://evil.example");
    assert.equal(bad.headers["access-control-allow-origin"], undefined);
  });
});

describe("HTTPS enforcement", () => {
  test("redirects GET and blocks POST over plain HTTP when enabled", async () => {
    const httpsApp = createApp({ ...loadConfig(), forceHttps: true, trustProxy: 1 });

    const get = await request(httpsApp).get("/api/projects").set("Host", "api.example.com");
    assert.equal(get.status, 308);
    assert.equal(get.headers.location, "https://api.example.com/api/projects");

    const post = await request(httpsApp).post("/api/auth/login").send({});
    assert.equal(post.status, 403);

    const proxied = await request(httpsApp).get("/api/health").set("X-Forwarded-Proto", "https");
    assert.equal(proxied.status, 200);
    assert.match(proxied.headers["strict-transport-security"], /max-age=63072000/);
  });
});

describe("input validation", () => {
  test("rejects NoSQL-injection objects instead of crashing", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: { $gt: "" }, password: { $gt: "" } });
    assert.equal(res.status, 400);
  });

  test("rejects invalid JSON with 400", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .set("Content-Type", "application/json")
      .send("{bad json");
    assert.equal(res.status, 400);
  });

  test("rejects oversized bodies with 413", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "a@b.co", password: "x".repeat(3 * 1024 * 1024) });
    assert.equal(res.status, 413);
  });

  test("signup validates email, password strength and length", async () => {
    assert.equal((await signUp({ ...validUser(90), email: "not-an-email" })).status, 400);
    assert.equal((await signUp({ ...validUser(91), password: "short1" })).status, 400);
    assert.equal((await signUp({ ...validUser(92), password: "onlyletters" })).status, 400);
    assert.equal((await signUp({ ...validUser(93), password: "a1".repeat(40) })).status, 400);
    assert.equal((await signUp({ ...validUser(94), name: "A" })).status, 400);
  });
});

describe("authentication (JWT + bcrypt)", () => {
  let token;

  test("signup hashes the password with bcrypt", async () => {
    const res = await signUp(validUser(1));
    assert.equal(res.status, 201);
    assert.ok(res.body.token);
    assert.equal(res.body.user.password, undefined);

    const stored = await User.findOne({ email: "user1@example.com" }).select("+password");
    assert.match(stored.password, /^\$2[aby]\$12\$/);
    assert.notEqual(stored.password, "secret123");
  });

  test("duplicate email returns 409 (case-insensitive)", async () => {
    const res = await signUp({ ...validUser(1), email: "USER1@Example.com" });
    assert.equal(res.status, 409);
  });

  test("login works and wrong password is rejected", async () => {
    const bad = await request(app).post("/api/auth/login").send({ email: "user1@example.com", password: "wrong123" });
    assert.equal(bad.status, 401);

    const unknown = await request(app).post("/api/auth/login").send({ email: "nobody@example.com", password: "wrong123" });
    assert.equal(unknown.status, 401);
    assert.equal(unknown.body.message, bad.body.message);

    const ok = await request(app).post("/api/auth/login").send({ email: "user1@example.com", password: "secret123" });
    assert.equal(ok.status, 200);
    token = ok.body.token;
  });

  test("/me requires a valid token", async () => {
    assert.equal((await request(app).get("/api/auth/me")).status, 401);
    assert.equal((await request(app).get("/api/auth/me").set("Authorization", "Bearer garbage")).status, 401);

    const me = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);
    assert.equal(me.status, 200);
    assert.equal(me.body.user.email, "user1@example.com");
  });

  test("logout revokes the token server-side", async () => {
    const out = await request(app).post("/api/auth/logout").set("Authorization", `Bearer ${token}`);
    assert.equal(out.status, 200);

    const me = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);
    assert.equal(me.status, 401);
  });
});

describe("projects", () => {
  let tokenA;
  let tokenB;
  let projectId;

  before(async () => {
    tokenA = (await signUp(validUser(10))).body.token;
    tokenB = (await signUp(validUser(11))).body.token;
  });

  const project = {
    projectType: "react",
    projectName: "Landing page",
    framework: "React + Vite",
    prompt: "A pricing section",
    files: [{ path: "src/App.jsx", content: "export default () => null;" }],
    dependencies: ["react-icons"],
  };

  test("create, list and fetch a project", async () => {
    const created = await request(app).post("/api/projects").set("Authorization", `Bearer ${tokenA}`).send(project);
    assert.equal(created.status, 201);
    projectId = created.body.project._id;

    const list = await request(app).get("/api/projects").set("Authorization", `Bearer ${tokenA}`);
    assert.equal(list.body.projects.length, 1);
    assert.equal(list.body.projects[0].files, undefined, "list omits heavy fields");

    const one = await request(app).get(`/api/projects/${projectId}`).set("Authorization", `Bearer ${tokenA}`);
    assert.equal(one.body.project.files[0].path, "src/App.jsx");
  });

  test("text search finds projects by name", async () => {
    const res = await request(app).get("/api/projects?q=landing").set("Authorization", `Bearer ${tokenA}`);
    assert.equal(res.body.projects.length, 1);
  });

  test("users cannot read or delete another user's project", async () => {
    assert.equal((await request(app).get(`/api/projects/${projectId}`).set("Authorization", `Bearer ${tokenB}`)).status, 404);
    assert.equal((await request(app).delete(`/api/projects/${projectId}`).set("Authorization", `Bearer ${tokenB}`)).status, 404);
  });

  test("invalid ids and invalid payloads return 400", async () => {
    assert.equal((await request(app).get("/api/projects/not-an-id").set("Authorization", `Bearer ${tokenA}`)).status, 400);

    const traversal = await request(app).post("/api/projects").set("Authorization", `Bearer ${tokenA}`)
      .send({ ...project, files: [{ path: "../../etc/passwd", content: "x" }] });
    assert.equal(traversal.status, 400);
  });

  test("owner can delete", async () => {
    const res = await request(app).delete(`/api/projects/${projectId}`).set("Authorization", `Bearer ${tokenA}`);
    assert.equal(res.status, 200);
  });

  test("compound and text indexes exist", async () => {
    const indexes = await Project.collection.indexes();
    assert.ok(indexes.some((i) => i.key.user === 1 && i.key.createdAt === -1));
    assert.ok(indexes.some((i) => i.name === "project_text_search"));
  });
});

describe("generation", () => {
  test("requires authentication", async () => {
    const res = await request(app).post("/api/generate").send({ prompt: "hi" });
    assert.equal(res.status, 401);
  });

  let token;

  const generate = (body) =>
    request(app).post("/api/generate").set("Authorization", `Bearer ${token}`).send(body);

  test("validates prompt/framework and reports missing provider key", async () => {
    token = (await signUp(validUser(20))).body.token;

    assert.equal((await generate({ prompt: " ", framework: "html" })).status, 400);
    assert.equal((await generate({ prompt: "x".repeat(5000), framework: "html" })).status, 400);
    assert.equal((await generate({ prompt: "a button", framework: "angular" })).status, 400);
    assert.equal((await generate({ prompt: "a button", framework: "__proto__" })).status, 400);
    assert.equal((await generate({ prompt: "a button", framework: "html" })).status, 503);
  });

  describe("with a mocked AI provider", () => {
    const realFetch = global.fetch;
    // Queue of replies; the last one repeats. Each call records the model used.
    let replies;
    let calls;

    before(() => {
      process.env.OPENROUTER_API_KEY = "test-key";
      process.env.OPENROUTER_MODELS = "model-a,model-b";
      global.fetch = async (url, init) => {
        // Fake npm registry: only react-icons (5.0.0-5.5.0) exists.
        if (String(url).startsWith("https://registry.npmjs.org/")) {
          return String(url).endsWith("/react-icons")
            ? new Response(JSON.stringify({ "dist-tags": { latest: "5.5.0" }, versions: { "5.0.0": {}, "5.5.0": {} } }))
            : new Response("{}", { status: 404 });
        }
        if (!String(url).includes("openrouter")) return realFetch(url, init);
        const body = JSON.parse(init.body);
        calls.push({ model: body.model, messages: body.messages });
        const reply = replies.length > 1 ? replies.shift() : replies[0];
        return new Response(JSON.stringify(reply.body), { status: reply.status });
      };
    });

    after(() => {
      global.fetch = realFetch;
      delete process.env.OPENROUTER_API_KEY;
      delete process.env.OPENROUTER_MODELS;
    });

    const ok = (content) => ({ status: 200, body: { choices: [{ message: { content } }] } });
    const fail = (status) => ({ status, body: { error: { code: status, message: "x" } } });
    const aiSays = (...queue) => {
      replies = queue;
      calls = [];
    };

    const block = (path, content) => `=== FILE: ${path} ===
${content}
=== END FILE ===`;

    test("html: strips code fences and uses the server-side system prompt", async () => {
      aiSays(ok("```html\n<!DOCTYPE html><p>Hi</p>\n```"));
      const res = await generate({ prompt: "a card", framework: "html" });
      assert.equal(res.status, 200);
      assert.equal(res.body.code, "<!DOCTYPE html><p>Hi</p>");
      assert.equal(calls[0].messages[0].role, "system");
      assert.equal(calls[0].messages[1].content, "a card");
    });

    test("react: parses file blocks, drops unsafe paths and repairs the project", async () => {
      aiSays(ok([
        block("package.json", JSON.stringify({ name: "My Demo!", dependencies: { react: "^19.0.0" } })),
        block("src/App.jsx", 'import { FaBolt } from "react-icons/fa";\nimport Nav from "./components/Nav";\nexport default () => <Nav />;'),
        block("src/components/Nav.jsx", "export default () => <nav />;"),
        block("../evil.js", "nope"),
      ].join("\n")));

      const res = await generate({ prompt: "a navbar", framework: "react-vite-tailwind" });
      assert.equal(res.status, 200);

      const { project } = res.body;
      const paths = project.files.map((f) => f.path).sort();
      assert.ok(!paths.some((p) => p.includes("..")));
      for (const required of ["index.html", "vite.config.js", "src/main.jsx", "src/index.css", "tailwind.config.js", "postcss.config.js"]) {
        assert.ok(paths.includes(required), `${required} is added`);
      }

      const pkg = JSON.parse(project.files.find((f) => f.path === "package.json").content);
      assert.equal(pkg.name, "my-demo");
      assert.equal(pkg.scripts.build, "vite build");
      assert.ok(pkg.dependencies["react-icons"], "missing imported package is declared");
      assert.ok(pkg.devDependencies.vite && pkg.devDependencies.tailwindcss);
      assert.match(project.files.find((f) => f.path === "src/index.css").content, /@tailwind utilities/);
    });

    test("react: still accepts the old JSON format", async () => {
      aiSays(ok(`{"files":[{"path":"src/App.jsx","content":"export default () => null;"}]}`));
      const res = await generate({ prompt: "a navbar", framework: "react-vite" });
      assert.equal(res.status, 200);
    });

    test("react: static check finds a runtime bug and the model fixes it", async () => {
      const broken = "const items = [{ q: 1, a: 2 }];\nexport default () => items.map((item) => <p key={item.q}>{a}</p>);";
      const fixed = "const items = [{ q: 1, a: 2 }];\nexport default () => items.map((item) => <p key={item.q}>{item.a}</p>);";
      aiSays(ok(block("src/App.jsx", broken)), ok(block("src/App.jsx", fixed)));

      const res = await generate({ prompt: "faq", framework: "react-vite" });
      assert.equal(res.status, 200);
      assert.equal(calls.length, 2);
      assert.equal(calls[1].model, calls[0].model, "fix uses the same model");
      assert.match(calls[1].messages.at(-1).content, /'a' is not defined/);
      assert.equal(res.body.project.files.find((f) => f.path === "src/App.jsx").content, fixed);
      assert.deepEqual(res.body.warnings, []);
    });

    test("react: invented versions are corrected and toolchain versions pinned", async () => {
      aiSays(ok([
        block("package.json", JSON.stringify({
          dependencies: { "react-icons": "^9.9.0", "made-up-pkg": "^1.0.0", react: "^99.0.0" },
          devDependencies: { "@vitejs/plugin-react": "^5.4.0" },
        })),
        block("src/App.jsx", "export default () => null;"),
      ].join("\n")), ok("no changes"));

      const res = await generate({ prompt: "x", framework: "react-vite" });
      const pkg = JSON.parse(res.body.project.files.find((f) => f.path === "package.json").content);

      assert.equal(pkg.dependencies["react-icons"], "^5.5.0");
      assert.equal(pkg.dependencies["made-up-pkg"], undefined);
      assert.equal(pkg.dependencies.react, "^19.1.0");
      assert.equal(pkg.devDependencies["@vitejs/plugin-react"], "^5.0.0");
      assert.match(res.body.warnings.join(" "), /made-up-pkg/);
    });

    test("react: unresolved problems are returned as warnings", async () => {
      aiSays(ok(block("src/App.jsx", "export default () => <Missing />;")), ok("sorry"));
      const res = await generate({ prompt: "x", framework: "react-vite" });
      assert.equal(res.status, 200);
      assert.equal(res.body.warnings.length, 1);
      assert.match(res.body.warnings[0], /'Missing' is not defined/);
    });

    test("falls back to the next model when one is rate-limited or useless", async () => {
      aiSays(fail(429), ok(block("src/App.jsx", "export default () => null;")));
      const res = await generate({ prompt: "a navbar", framework: "react-vite" });
      assert.equal(res.status, 200);
      assert.deepEqual(calls.map((c) => c.model), ["model-a", "model-b"]);

      aiSays(ok(""), ok("<!DOCTYPE html><p>ok</p>"));
      const html = await generate({ prompt: "a card", framework: "html" });
      assert.equal(html.status, 200);
      assert.equal(calls.length, 2);
    });

    test("unusable output from every model becomes a friendly 503", async () => {
      aiSays(ok("{ not json"));
      const res = await generate({ prompt: "a navbar", framework: "react-vite" });
      assert.equal(res.status, 503);
      assert.equal(calls.length, 2);
    });

    test("all models rate-limited returns 429", async () => {
      aiSays(fail(429));
      const res = await generate({ prompt: "a navbar", framework: "html" });
      assert.equal(res.status, 429);
    });

    test("an invalid API key stops after the first model", async () => {
      aiSays(fail(401));
      const res = await generate({ prompt: "a navbar", framework: "html" });
      assert.equal(res.status, 503);
      assert.equal(calls.length, 1);
    });
  });
});

describe("rate limiting", () => {
  test("login is limited after 10 failed attempts", async () => {
    const attempt = () =>
      request(app).post("/api/auth/login").send({ email: "brute@example.com", password: "wrong123" });

    let last;
    for (let i = 0; i < 12; i++) last = await attempt();

    assert.equal(last.status, 429);
    assert.ok(last.headers["ratelimit-policy"] || last.headers.ratelimit);
  });

  test("a locked account doesn't block other accounts on the same IP", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "someone-else@example.com", password: "wrong123" });

    assert.equal(res.status, 401);
  });

  test("validation errors don't count as failed attempts", async () => {
    let last;
    for (let i = 0; i < 12; i++) {
      last = await request(app)
        .post("/api/auth/signup")
        .send({ name: "Typo", email: "typo@example.com", password: "short" });
    }

    assert.equal(last.status, 400);
  });
});
