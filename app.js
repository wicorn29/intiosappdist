"use strict";

const $ = id => document.getElementById(id);
let catalog = [];
let selectedApps = [];

$("year").textContent = new Date().getFullYear();

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[c]);
}

function resolveURL(path, base) {
  return new URL(path, base).href;
}

function otaLink(manifestPath) {
  const manifestURL = resolveURL(manifestPath, location.href);
  return "itms-services://?action=download-manifest&url=" +
    encodeURIComponent(manifestURL);
}

async function loadCatalog() {
  const root = await fetch("apps/index.json", {cache: "no-store"});
  if (!root.ok) throw new Error("Could not read apps/index.json");

  const index = await root.json();
  const entries = Array.isArray(index.apps) ? index.apps : [];

  catalog = await Promise.all(entries.map(async entry => {
    const metadataURL = resolveURL(entry.metadata, location.href);
    const response = await fetch(metadataURL, {cache: "no-store"});
    if (!response.ok) throw new Error("Could not load " + entry.metadata);

    const app = await response.json();

    return {
      ...app,
      manifestPath: entry.manifest,
      metadataURL
    };
  }));

  const categories = [...new Set(
    catalog.map(app => app.category).filter(Boolean)
  )].sort();

  categories.forEach(name => {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    $("category").appendChild(option);
  });

  $("app-count").textContent = catalog.length + " APPLICATIONS";
  $("catalog-status").textContent = "W29 SOFTWARE";
  render();
}

function render() {
  const query = $("search").value.toLowerCase().trim();
  const category = $("category").value;

  selectedApps = catalog.filter(app => {
    const text = [
      app.name, app.description, app.subtitle,
      app.bundleId, app.category, app.developer
    ].join(" ").toLowerCase();

    return (!query || text.includes(query)) &&
      (!category || category === app.category);
  });

  if (!selectedApps.length) {
    $("apps").innerHTML =
      '<div class="empty">No applications found.</div>';
    return;
  }

  $("apps").innerHTML = selectedApps.map(app => {
    const base = new URL(".", app.metadataURL).href;
    const icon = app.icon ? resolveURL(app.icon, base) : "";

    return `
      <article class="app-card">
        <div class="app-top">
          ${icon
            ? `<img class="app-icon" src="${escapeHTML(icon)}" alt="">`
            : `<div class="app-icon"></div>`}
          <div>
            <div class="app-name">${escapeHTML(app.name)}</div>
            <div class="app-subtitle">${escapeHTML(app.subtitle)}</div>
            <div class="app-version">VERSION ${escapeHTML(app.version)}</div>
          </div>
        </div>
        <p class="app-description">${escapeHTML(app.description)}</p>
        <div class="app-actions">
          <span class="tag">${escapeHTML(app.category || "APPLICATION")}</span>
          <button class="details-button" data-app="${escapeHTML(app.id)}">
            DETAILS →
          </button>
        </div>
      </article>`;
  }).join("");
}

function showDetails(id) {
  const app = catalog.find(a => a.id === id);
  if (!app) return;

  const base = new URL(".", app.metadataURL).href;
  const icon = app.icon ? resolveURL(app.icon, base) : "";
  const screenshots = (app.screenshots || []).map(path =>
    `<img src="${escapeHTML(resolveURL(path, base))}" alt="Screenshot">`
  ).join("");

  $("detail-content").innerHTML = `
    ${icon ? `<img class="detail-icon" src="${escapeHTML(icon)}" alt="">` : ""}
    <h2>${escapeHTML(app.name)}</h2>
    <p class="app-subtitle">${escapeHTML(app.subtitle)}</p>
    <p class="detail-description">${escapeHTML(app.description)}</p>
    <div class="detail-meta">DEVELOPER: ${escapeHTML(app.developer)}</div>
    <div class="detail-meta">VERSION: ${escapeHTML(app.version)}</div>
    <div class="detail-meta">BUILD: ${escapeHTML(app.build)}</div>
    <div class="detail-meta">BUNDLE: ${escapeHTML(app.bundleId)}</div>
    <div class="detail-meta">CATEGORY: ${escapeHTML(app.category)}</div>
    ${app.releaseNotes
      ? `<h3>Release notes</h3><p>${escapeHTML(app.releaseNotes)}</p>`
      : ""}
    ${screenshots ? `<h3>Screenshots</h3><div class="screenshots">${screenshots}</div>` : ""}
    <a class="install" href="${escapeHTML(otaLink(app.manifestPath))}">
      INSTALL ON IPHONE / IPAD
    </a>
  `;

  $("details").showModal();
}

$("apps").addEventListener("click", event => {
  const button = event.target.closest("[data-app]");
  if (button) showDetails(button.dataset.app);
});

$("search").addEventListener("input", render);
$("category").addEventListener("change", render);
$("close").addEventListener("click", () => $("details").close());

$("details").addEventListener("click", event => {
  if (event.target === $("details")) $("details").close();
});

loadCatalog().catch(error => {
  console.error(error);
  $("apps").innerHTML =
    '<div class="empty">Catalog could not be loaded. Check apps/index.json and your hosting configuration.</div>';
  $("app-count").textContent = "CATALOG ERROR";
});
