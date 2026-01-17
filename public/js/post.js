function getSlug() {
  const params = new URLSearchParams(window.location.search);
  return params.get("slug");
}

async function loadPost() {
  const slug = getSlug();
  const el = document.getElementById("post");

  if (!slug) {
    el.innerHTML = "<p>Haber bulunamadı (slug yok).</p>";
    return;
  }

  const res = await fetch(`/api/posts/${encodeURIComponent(slug)}`);

  if (res.status === 404) {
    el.innerHTML = "<p>Haber bulunamadı.</p>";
    return;
  }

  const p = await res.json();

el.innerHTML = `
  <h1>${p.title}</h1>
  <div class="meta">
    <span class="badge">${p.category || "Kategorisiz"}</span>
    <span class="badge">${new Date(p.created_at).toLocaleString("tr-TR")}</span>
  </div>

  ${p.image_url ? `<img class="detail-image" src="${p.image_url}" alt="">` : ""}

  ${p.summary ? `<p><em>${p.summary}</em></p>` : ""}

  <div class="hr"></div>
  <div style="color: var(--text); line-height:1.7;">
    ${(p.content || "").replaceAll("\n", "<br/>")}
  </div>
`;

}

loadPost().catch(err => {
  document.getElementById("post").innerHTML = "Hata: " + err.message;
});
