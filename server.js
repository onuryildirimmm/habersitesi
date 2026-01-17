const db = require("./db");
const session = require("express-session");
const bcrypt = require("bcryptjs");
console.log("DB TYPE:", typeof db);
console.log("DB KEYS:", Object.keys(db));
const express = require("express");
const path = require("path");
const cors = require("cors");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());
app.use(
  session({
    secret: "change-this-secret",
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true }
  })
);

app.use(express.static(path.join(__dirname, "public")));

app.get("/api/health", (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

app.get("/api/posts", async (req, res) => {
  try {
    const { category, q } = req.query; // category = slug, q = arama

    let sql = `
      SELECT
        p.id, p.title, p.slug, p.summary, p.image_url, p.created_at,
        c.name AS category, c.slug AS category_slug
      FROM posts p
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE p.status = 'published'
    `;
    const params = [];

    if (category) {
      sql += ` AND c.slug = ? `;
      params.push(category);
    }
    if (q) {
      sql += ` AND p.title LIKE ? `;
      params.push(`%${q}%`);
    }

    sql += ` ORDER BY p.created_at DESC LIMIT 50`;

    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


app.get("/api/posts/:slug", async (req, res) => {
  try {
    const { slug } = req.params;

    const [rows] = await db.query(
      `
      SELECT p.id, p.title, p.slug, p.summary, p.content, p.image_url, p.created_at,
             c.name AS category
      FROM posts p
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE p.slug = ? AND p.status = 'published'
      LIMIT 1
      `,
      [slug]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Post not found" });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error("DB ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: "Username and password required" });
    }

    const [rows] = await db.query(
      "SELECT id, username, password_hash FROM users WHERE username = ? LIMIT 1",
      [username]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const user = rows[0];
    const ok = await bcrypt.compare(password, user.password_hash);

    if (!ok) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    req.session.userId = user.id;
    req.session.username = user.username;

    res.json({ ok: true, username: user.username });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/auth/me", (req, res) => {
  if (req.session?.userId) {
    return res.json({ ok: true, username: req.session.username });
  }
  res.status(401).json({ ok: false });
});

app.post("/api/auth/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});


function requireAuth(req, res, next) {
  if (req.session?.userId) return next();
  return res.status(401).json({ error: "Unauthorized" });
}

app.get("/api/admin/posts", requireAuth, async (req, res) => {
  try {
    const { status, category_id, q } = req.query;

    let sql = `
      SELECT
        p.id, p.title, p.slug, p.status, p.created_at,
        c.name AS category, c.slug AS category_slug
      FROM posts p
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      sql += ` AND p.status = ? `;
      params.push(status);
    }
    if (category_id) {
      sql += ` AND p.category_id = ? `;
      params.push(Number(category_id));
    }
    if (q) {
      sql += ` AND p.title LIKE ? `;
      params.push(`%${q}%`);
    }

    sql += ` ORDER BY p.created_at DESC LIMIT 200`;

    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/categories", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT id, name, slug FROM categories ORDER BY name");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


app.post("/api/admin/posts", requireAuth, async (req, res) => {
  console.log("BODY:", req.body);
  try {
    const { title, summary, content, category_id, status, image_url} = req.body;

    if (!title || !content) {
      return res.status(400).json({ error: "title and content required" });
    }

    const slug = title
      .toLowerCase()
      .trim()
      .replaceAll("ğ", "g").replaceAll("ü", "u").replaceAll("ş", "s")
      .replaceAll("ı", "i").replaceAll("ö", "o").replaceAll("ç", "c")
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-");

    const [result] = await db.query(
      `INSERT INTO posts (title, slug, summary, content, image_url, category_id, status)
                  VALUES (?, ?, ?, ?, ?, ?, ?)`,
     [title, slug, summary || null, content, image_url || null, category_id || null, status || "draft"]
    );

    res.json({ ok: true, id: result.insertId, slug });
  } catch (err) {
    // slug unique çakışırsa:
    if (String(err.message || "").includes("Duplicate")) {
      return res.status(409).json({ error: "Slug already exists. Change title." });
    }
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/admin/posts/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    await db.query("DELETE FROM posts WHERE id = ?", [id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch("/api/admin/posts/:id/status", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!["draft", "published"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    await db.query("UPDATE posts SET status = ? WHERE id = ?", [status, id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/admin/categories", requireAuth, async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT id, name, slug FROM categories ORDER BY name ASC"
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/admin/categories", requireAuth, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: "name required" });
    }

    const slug = name
      .toLowerCase()
      .trim()
      .replaceAll("ğ", "g").replaceAll("ü", "u").replaceAll("ş", "s")
      .replaceAll("ı", "i").replaceAll("ö", "o").replaceAll("ç", "c")
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-");

    const [result] = await db.query(
      "INSERT INTO categories (name, slug) VALUES (?, ?)",
      [name.trim(), slug]
    );

    res.json({ ok: true, id: result.insertId, slug });
  } catch (err) {
    if (String(err.message || "").includes("Duplicate")) {
      return res.status(409).json({ error: "Bu kategori zaten var." });
    }
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/admin/categories/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    await db.query("DELETE FROM categories WHERE id = ?", [id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


app.get("/api/admin/posts/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await db.query(
      `SELECT id, title, slug, summary, content, category_id, status, image_url
       FROM posts
       WHERE id = ?
       LIMIT 1`,
      [id]
    );

    if (rows.length === 0) return res.status(404).json({ error: "Not found" });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.put("/api/admin/posts/:id", requireAuth, async (req, res) => {
  console.log("BODY:", req.body);

  try {
    const { id } = req.params;
    const { title, summary, content, category_id, status, image_url } = req.body;


    if (!title || !content) {
      return res.status(400).json({ error: "title and content required" });
    }
    if (!["draft", "published"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    await db.query(
      `UPDATE posts
SET title = ?, summary = ?, content = ?, image_url = ?, category_id = ?, status = ?
WHERE id = ?
`,
      [title, summary || null, content, image_url || null, category_id ?? null, status, id]

    );

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


/*
app.get("/api/posts", async (req, res) => {
  res.json({ message: "posts endpoint çalışıyor" });
});
*/
const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
  console.log(`🚀 Server running: http://localhost:${port}`);
});

app.post("/api/admin/posts/:id/toggle", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await db.query("SELECT status FROM posts WHERE id = ? LIMIT 1", [id]);
    if (rows.length === 0) return res.status(404).json({ error: "Post not found" });

    const current = rows[0].status;
    const next = current === "published" ? "draft" : "published";

    await db.query("UPDATE posts SET status = ? WHERE id = ?", [next, id]);

    res.json({ ok: true, status: next });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
