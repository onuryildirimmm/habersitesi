async function loadNews() {
  const res = await fetch("/api/posts");
  const data = await res.json();

  const el = document.getElementById("news");

  if (!Array.isArray(data) || data.length === 0) {
    el.innerHTML = "<p>Henüz haber yok.</p>";
    return;
  }

el.innerHTML = data.map(p => `
  <article class="card">
    <h2>${p.title}</h2>

    <div class="meta">
      <span class="badge">${p.category || "Kategorisiz"}</span>
      <span class="badge">${new Date(p.created_at).toLocaleString("tr-TR")}</span>
    </div>

    ${p.image_url ? `<img class="thumb" src="${p.image_url}" alt="">` : ""}

    ${p.summary ? `<p>${p.summary}</p>` : ""}

    <div class="row" style="margin-top:10px;">
      <a class="btn primary" href="/post.html?slug=${encodeURIComponent(p.slug)}">Devamını oku</a>
    </div>
  </article>
`).join("");

}

loadNews().catch(err => {
  document.getElementById("news").innerHTML = "Hata: " + err.message;
});


async function loadCategoriesPublic() {
  const sel = document.getElementById("catFilter");
  if (!sel) return;

  const res = await fetch("/api/categories");
  const cats = await res.json();

  sel.innerHTML = `<option value="">Tüm kategoriler</option>` + cats
    .map(c => `<option value="${c.slug}">${c.name}</option>`)
    .join("");
}

function setUrlParams(category, q) {
  const url = new URL(location.href);
  if (category) url.searchParams.set("category", category);
  else url.searchParams.delete("category");

  if (q) url.searchParams.set("q", q);
  else url.searchParams.delete("q");

  history.replaceState({}, "", url);
}

function getUrlParams() {
  const sp = new URLSearchParams(location.search);
  return { category: sp.get("category") || "", q: sp.get("q") || "" };
}

async function loadPostsWithFilters() {
  const { category, q } = getUrlParams();

  const url = new URL("/api/posts", location.origin);
  if (category) url.searchParams.set("category", category);
  if (q) url.searchParams.set("q", q);

  const res = await fetch(url);
  const data = await res.json();

  const el = document.getElementById("news");
  el.innerHTML = data.map(p => `
    <article class="card">
      <h2>${p.title}</h2>
      <div class="meta">
        <span class="badge">${p.category || "Kategorisiz"}</span>
        <span class="badge">${new Date(p.created_at).toLocaleString("tr-TR")}</span>
      </div>
      ${p.image_url ? `<img class="thumb" src="${p.image_url}" alt="">` : ""}
      ${p.summary ? `<p>${p.summary}</p>` : ""}
      <div class="row" style="margin-top:10px;">
        <a class="btn primary" href="/post.html?slug=${encodeURIComponent(p.slug)}">Devamını oku</a>
      </div>
    </article>
  `).join("");

  // filtre inputlarını URL'den doldur
  const catSel = document.getElementById("catFilter");
  const qInp = document.getElementById("qFilter");
  if (catSel) catSel.value = category;
  if (qInp) qInp.value = q;
}

function setupPublicFilters() {
  const btn = document.getElementById("applyFilter");
  const clr = document.getElementById("clearFilter");
  const catSel = document.getElementById("catFilter");
  const qInp = document.getElementById("qFilter");

  btn?.addEventListener("click", () => {
    setUrlParams(catSel.value, qInp.value.trim());
    loadPostsWithFilters();
  });

  clr?.addEventListener("click", () => {
    setUrlParams("", "");
    loadPostsWithFilters();
  });

  // Enter ile ara
  qInp?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      btn.click();
    }
  });
}

loadCategoriesPublic().then(() => {
  setupPublicFilters();
  loadPostsWithFilters();
});
