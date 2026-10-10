const itemForm = document.querySelector("#item-form");
const mediaForm = document.querySelector("#media-form");
const list = document.querySelector("#items");
const status = document.querySelector("#status");
let editingId = null;
let items = [];

function report(message, error = false) {
  status.textContent = message;
  if (error) status.dataset.error = "";
  else delete status.dataset.error;
}

async function request(url, options = {}) {
  const response = await fetch(url, { cache: "no-store", ...options });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `请求失败：${response.status}`);
  }
  return response.json();
}

function field(form, name) { return form.elements.namedItem(name); }

function switchKind() {
  const isDocument = field(itemForm, "kind").value === "document";
  for (const element of document.querySelectorAll(".document-field")) element.hidden = !isDocument;
  document.querySelector(".link-field").hidden = isDocument;
  field(itemForm, "publishedAt").required = isDocument;
  field(itemForm, "href").required = !isDocument;
}

function resetEditor() {
  editingId = null;
  itemForm.reset();
  field(itemForm, "publishedAt").value = new Date().toISOString().slice(0, 10);
  switchKind();
}

function edit(item) {
  if (item.kind === "media") return;
  editingId = item.id;
  for (const name of ["kind", "relativePath", "title", "summary", "sortOrder", "status"]) field(itemForm, name).value = item[name];
  switchKind();
  if (item.kind === "document") {
    field(itemForm, "publishedAt").value = item.publishedAt;
    field(itemForm, "tags").value = item.tags.join(", ");
    field(itemForm, "markdown").value = item.markdown;
  } else field(itemForm, "href").value = item.href;
  itemForm.scrollIntoView({ behavior: "smooth" });
}

async function reload() {
  items = (await request("/api/v1/admin/items")).items;
  list.replaceChildren();
  for (const item of items) {
    const li = document.createElement("li");
    const label = document.createElement("span");
    label.textContent = `${item.status === "published" ? "已发布" : "草稿"} · ${item.sortOrder} · ${item.relativePath} · ${item.title}`;
    li.append(label);
    const actions = [
      ...(item.kind === "media" ? [] : [["编辑", () => edit(item)]]),
      [item.status === "published" ? "转草稿" : "发布", async () => { await request(`/api/v1/admin/items/${item.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: item.status === "published" ? "draft" : "published" }) }); await reload(); }],
      ["删除", async () => { if (!confirm(`确定删除 ${item.relativePath}？`)) return; await request(`/api/v1/admin/items/${item.id}`, { method: "DELETE" }); await reload(); }]
    ];
    for (const [text, action] of actions) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = text;
      button.addEventListener("click", () => { Promise.resolve(action()).catch((error) => report(error.message, true)); });
      li.append(button);
    }
    list.append(li);
  }
}

itemForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const kind = field(itemForm, "kind").value;
  const payload = {
    kind, relativePath: field(itemForm, "relativePath").value.trim(), title: field(itemForm, "title").value.trim(),
    summary: field(itemForm, "summary").value.trim(), sortOrder: Number(field(itemForm, "sortOrder").value), status: field(itemForm, "status").value,
    ...(kind === "document" ? { markdown: field(itemForm, "markdown").value, publishedAt: field(itemForm, "publishedAt").value, tags: field(itemForm, "tags").value.split(",").map((tag) => tag.trim()).filter(Boolean) } : { href: field(itemForm, "href").value.trim() })
  };
  const url = editingId ? `/api/v1/admin/items/${editingId}` : "/api/v1/admin/items";
  const method = editingId ? "PATCH" : "POST";
  const body = editingId ? { ...payload, kind: undefined } : payload;
  if (editingId) delete body.kind;
  request(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    .then(() => { report("保存成功"); resetEditor(); return reload(); })
    .catch((error) => report(error.message, true));
});

mediaForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const file = field(mediaForm, "file").files[0];
  if (!file) return;
  request("/api/v1/admin/media", {
    method: "POST", body: file,
    headers: { "Content-Type": file.type, "X-Content-Path": field(mediaForm, "relativePath").value.trim(), "X-Content-Title": field(mediaForm, "title").value.trim(), "X-Content-Alt": field(mediaForm, "alt").value.trim(), "X-Content-Sort-Order": field(mediaForm, "sortOrder").value }
  }).then(() => { report("上传成功，尚未发布"); mediaForm.reset(); return reload(); }).catch((error) => report(error.message, true));
});

field(itemForm, "kind").addEventListener("change", switchKind);
document.querySelector("#clear-form").addEventListener("click", resetEditor);
document.querySelector("#reload").addEventListener("click", () => reload().catch((error) => report(error.message, true)));
resetEditor();
reload().catch((error) => report(error.message, true));
