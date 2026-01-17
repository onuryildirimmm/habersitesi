// public/admin/admin.js

// ---------- Helpers ----------
async function me() {
  const res = await fetch("/api/auth/me", { credentials: "include" });
  if (!res.ok) return null;
  return res.json();
}

async function adminFetch(url, options = {}) {
  const res = await fetch(url, {
    credentials: "include",
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  if (res.status === 401) {
    location.href = "/admin/login.html";
    return null;
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

function getQueryParam(name) {
  return new URLSearchParams(location.search).get(name);
}

// ---------- Auth (login & guard) ----------
async function setupLoginForm() {
  const form = document.getElementById("loginForm");
  if (!form) return;

  const user = await me();
  if (user) {
    location.href = "/admin/index.html";
    return;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value;
    const msg = document.getElementById("msg");

    const res = await fetch("/api/auth/login", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      msg.textContent = data.error || "Giriş başarısız";
      return;
    }

    location.href = "/admin/index.html";
  });
}

async function guardAdminPage() {
  const isAdminPage =
    location.pathname.startsWith("/admin/") &&
    !location.pathname.endsWith("login.html");

  if (!isAdminPage) return;

  const user = await me();
  if (!user) {
    location.href = "/admin/login.html";
    return;
  }

  const who = document.getElementById("who");
  if (who) who.textContent = `Giriş yapan: ${user.username}`;

  const logoutBtn = document.getElementById("logout");
  if (logoutBtn) {
    logoutBtn.onclick = async () => {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
      location.href = "/admin/login.html";
    };
  }
}

// ---------- Categories helpers ----------
async function loadCategoriesIntoSelect(selectId, placeholderText) {
  const sel = document.getElementById(selectId);
  if (!sel) return;

  const cats = await adminFetch("/api/admin/categories");
  if (!cats) return;

  sel.innerHTML =
    `<option value="">${placeholderText}</option>` +
    cats.map(c => `<option value="${c.id}">${c.name}</option>`).join("");
}

// ---------- Admin Index (posts list + filters) ----------
async function loadAdminPosts() {
  const el = document.getElementById("adminPosts");
  if (!el) return;

  // filters (may or may not exist)
  const status = document.getElementById("adminStatus")?.value || "";
  const categoryId = document.getElementById("adminCat")?.value || "";
  const q = document.getElementById("adminQ")?.value?.trim() || "";

  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (categoryId) params.set("category_id", categoryId);
  if (q) params.set("q", q);

  const url = "/api/admin/posts" + (params.toString() ? `?${params}` : "");

  const posts = await adminFetch(url);
  if (!Array.isArray(posts)) {
    el.innerHTML = `<p>Liste alınamadı.</p>`;
    console.log("ADMIN POSTS RESPONSE:", posts);
    return;
  }

  if (posts.length === 0) {
    el.innerHTML = `<p>Sonuç yok.</p>`;
    return;
  }

  el.innerHTML = posts.map(p => `
    <div class="card" style="margin-bottom:10px;">
      <h2 style="margin:0 0 6px;">${p.title}</h2>

      <div class="meta">
        <span class="badge">${p.category || "Kategorisiz"}</span>
        <span class="badge ${p.status === "published" ? "ok" : "warn"}">${p.status}</span>
        <span class="badge">${new Date(p.created_at).toLocaleString("tr-TR")}</span>
      </div>

      <div class="row" style="margin-top:10px;">
        <a class="btn" href="/post.html?slug=${encodeURIComponent(p.slug)}" target="_blank">Detay</a>
        <a class="btn primary" href="/admin/editor.html?id=${p.id}">Düzenle</a>

        <button class="btn" data-toggle="${p.id}">
          ${p.status === "published" ? "Taslağa Al" : "Yayınla"}
        </button>

        <button class="btn danger" data-del="${p.id}">Sil</button>
      </div>
    </div>
  `).join("");

  // Toggle
  el.querySelectorAll("button[data-toggle]").forEach(btn => {
    btn.onclick = async () => {
      const id = btn.dataset.toggle;
      await adminFetch(`/api/admin/posts/${id}/toggle`, { method: "POST" });
      loadAdminPosts();
    };
  });

  // Delete
  el.querySelectorAll("button[data-del]").forEach(btn => {
    btn.onclick = async () => {
      const id = btn.dataset.del;
      if (!confirm("Silmek istediğine emin misin?")) return;
      await adminFetch(`/api/admin/posts/${id}`, { method: "DELETE" });
      loadAdminPosts();
    };
  });
}

function setupAdminFilters() {
  const apply = document.getElementById("adminApply");
  const clear = document.getElementById("adminClear");
  const qEl = document.getElementById("adminQ");

  apply?.addEventListener("click", () => loadAdminPosts());

  clear?.addEventListener("click", () => {
    const s = document.getElementById("adminStatus");
    const c = document.getElementById("adminCat");
    const q = document.getElementById("adminQ");
    if (s) s.value = "";
    if (c) c.value = "";
    if (q) q.value = "";
    loadAdminPosts();
  });

  qEl?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      loadAdminPosts();
    }
  });
}

// ---------- Editor page (create + edit) ----------
async function setupEditorPage() {
  const form = document.getElementById("editorForm");
  if (!form) return;

  await loadCategoriesIntoSelect("category_id", "Kategori seç (opsiyonel)");

  const id = getQueryParam("id");
  const isEdit = Boolean(id);

  const titleEl = document.getElementById("title");
  const summaryEl = document.getElementById("summary");
  const contentEl = document.getElementById("content");
  const statusEl = document.getElementById("status");
  const imageUrlEl = document.getElementById("image_url");
  const categoryEl = document.getElementById("category_id");
  const msgEl = document.getElementById("msg");
  const pageTitle = document.getElementById("pageTitle");
  const saveBtn = document.getElementById("saveBtn");

  if (isEdit) {
    pageTitle && (pageTitle.textContent = "Haberi Düzenle");
    saveBtn && (saveBtn.textContent = "Güncelle");

    const post = await adminFetch(`/api/admin/posts/${id}`);
    if (!post) return;

    titleEl.value = post.title || "";
    summaryEl.value = post.summary || "";
    contentEl.value = post.content || "";
    statusEl.value = post.status || "draft";
    categoryEl.value = post.category_id ?? "";
    imageUrlEl.value = post.image_url || "";
  } else {
    pageTitle && (pageTitle.textContent = "Yeni Haber");
    saveBtn && (saveBtn.textContent = "Kaydet");
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (msgEl) msgEl.textContent = "Kaydediliyor...";

    const payload = {
      title: titleEl.value.trim(),
      summary: summaryEl.value.trim(),
      content: contentEl.value,
      status: statusEl.value,
      category_id: categoryEl.value ? Number(categoryEl.value) : null,
      image_url: imageUrlEl.value.trim() || null
    };

    try {
      if (isEdit) {
        await adminFetch(`/api/admin/posts/${id}`, {
          method: "PUT",
          body: JSON.stringify(payload)
        });
      } else {
        await adminFetch("/api/admin/posts", {
          method: "POST",
          body: JSON.stringify(payload)
        });
      }

      if (msgEl) msgEl.textContent = "✅ Kaydedildi";
      setTimeout(() => (location.href = "/admin/index.html"), 600);
    } catch (err) {
      if (msgEl) msgEl.textContent = "❌ " + err.message;
    }
  });
}

// ---------- Categories page ----------
async function loadCategoriesList() {
  const listEl = document.getElementById("catList");
  if (!listEl) return;

  const cats = await adminFetch("/api/admin/categories");
  if (!cats) return;

  if (cats.length === 0) {
    listEl.innerHTML = "<p>Kategori yok.</p>";
    return;
  }

  listEl.innerHTML = cats.map(c => `
    <div class="card" style="display:flex;justify-content:space-between;align-items:center;gap:10px;">
      <span>${c.name}</span>
      <button class="btn danger" data-catdel="${c.id}">Sil</button>
    </div>
  `).join("");

  listEl.querySelectorAll("button[data-catdel]").forEach(btn => {
    btn.onclick = async () => {
      if (!confirm("Kategoriyi silmek istediğine emin misin?")) return;
      await adminFetch(`/api/admin/categories/${btn.dataset.catdel}`, { method: "DELETE" });
      await loadCategoriesList();
    };
  });
}

async function setupCategoryForm() {
  const form = document.getElementById("catForm");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const msg = document.getElementById("catMsg");
    if (msg) msg.textContent = "Ekleniyor...";

    try {
      const name = document.getElementById("catName").value.trim();
      await adminFetch("/api/admin/categories", {
        method: "POST",
        body: JSON.stringify({ name })
      });

      if (msg) msg.textContent = "✅ Eklendi";
      form.reset();
      await loadCategoriesList();
    } catch (err) {
      if (msg) msg.textContent = "❌ " + err.message;
    }
  });
}

// ---------- Boot ----------
setupLoginForm();
guardAdminPage();

// Index page
if (document.getElementById("adminPosts")) {
  loadCategoriesIntoSelect("adminCat", "Tüm kategoriler").then(() => {
    setupAdminFilters();
    loadAdminPosts();
  });
}

// Editor page
setupEditorPage();

// Categories page
setupCategoryForm();
loadCategoriesList();
