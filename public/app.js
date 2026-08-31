/* RealEstate — front end. Talks only to the app's own API on the ALB. */

const CDN_DOMAIN = "https://da7iev0eznc8q.cloudfront.net";

const $ = (id) => document.getElementById(id);

const state = { category: "", city: "" };

// SVG placeholder for missing images - diagonal hatching pattern
const SVG_PLACEHOLDER = `<svg viewBox="0 0 320 180" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <pattern id="hatch" patternUnits="userSpaceOnUse" width="8" height="8">
      <line x1="0" y1="0" x2="8" y2="8" stroke="#D3DEDA" stroke-width="1"/>
      <line x1="8" y1="0" x2="0" y2="8" stroke="#D3DEDA" stroke-width="1"/>
    </pattern>
  </defs>
  <rect width="320" height="180" fill="#EEF3F0"/>
  <rect width="320" height="180" fill="url(#hatch)"/>
</svg>`;

/* ---- live infrastructure ledger ---------------------------------------- */
async function loadLedger() {
  try {
    const r = await fetch("/api/meta");
    const m = await r.json();
    $("ledger-instance").textContent = m.instanceId;
    $("ledger-az").textContent = m.availabilityZone;
  } catch {
    $("ledger-instance").textContent = "unavailable";
  }
}

/* ---- stats -------------------------------------------------------------- */
async function loadStats() {
  try {
    const r = await fetch("/api/stats");
    const s = await r.json();
    $("stat-total").textContent = s.total;
    $("stat-property").textContent = s.property;
    $("stat-vehicle").textContent = s.vehicle;
    $("stat-cities").textContent = s.cities;
  } catch {
    /* the readout keeps its dashes */
  }
}

/* ---- listings ----------------------------------------------------------- */
const money = (n, c) =>
  (c === "SOS" ? "Sh " : "$") + Number(n).toLocaleString("en-US");

function specsFor(item) {
  const rows = [];
  if (item.category === "property") {
    if (item.bedrooms != null) rows.push(["Beds", item.bedrooms]);
    if (item.bathrooms != null) rows.push(["Baths", item.bathrooms]);
    if (item.areaSqm != null) rows.push(["Area", `${item.areaSqm} m²`]);
  } else {
    if (item.year) rows.push(["Year", item.year]);
    if (item.mileageKm != null) rows.push(["Mileage", `${Number(item.mileageKm).toLocaleString()} km`]);
    if (item.fuel) rows.push(["Fuel", item.fuel]);
  }
  if (!rows.length) return "";
  return `<dl class="specs">${rows
    .map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`)
    .join("")}</dl>`;
}

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );

function cardFor(item) {
  const place = [item.district, item.city].filter(Boolean).join(", ");
  const imageHtml = item.images && item.images[0]
    ? `<img src="${CDN_DOMAIN}/listings/${item.images[0]}" alt="${esc(item.title)}" width="320" height="180" loading="lazy" onerror="this.outerHTML='${SVG_PLACEHOLDER}'" />`
    : SVG_PLACEHOLDER;
  
  return `
    <article class="card">
      <div class="card__image">${imageHtml}</div>
      <div class="card__head">
        <span class="card__tag" data-cat="${esc(item.category)}">${item.category === "property" ? "Property" : "Vehicle"}</span>
        <span class="card__ref">${esc(String(item.listingId).slice(0, 8))}</span>
      </div>
      <div class="card__body">
        <h3 class="card__title">${esc(item.title)}</h3>
        <p class="card__desc">${esc(item.description || "")}</p>
        <p class="card__price">${money(item.price, item.currency)}</p>
        <p class="card__place">${esc(place)}</p>
        ${specsFor(item)}
      </div>
      <div class="card__foot">
        <span class="card__contact">${esc(item.contactName || "Owner")}</span>
        <a class="card__call" href="tel:${esc(String(item.contactPhone).replace(/\s/g, ""))}">${esc(item.contactPhone)}</a>
      </div>
    </article>`;
}

async function loadListings() {
  const grid = $("grid");
  grid.setAttribute("aria-busy", "true");
  grid.innerHTML = `<p class="state">Loading listings…</p>`;

  const params = new URLSearchParams();
  if (state.category) params.set("category", state.category);
  if (state.city) params.set("city", state.city);

  try {
    const r = await fetch(`/api/listings?${params}`);
    if (!r.ok) throw new Error("bad response");
    const { items } = await r.json();

    if (!items.length) {
      grid.innerHTML = `<p class="state">Nothing matches that search yet. Try another city, or list the first one.</p>`;
    } else {
      grid.innerHTML = items.map(cardFor).join("");
    }
  } catch {
    grid.innerHTML = `<p class="state">The listings could not be loaded. Check your connection and reload the page.</p>`;
  } finally {
    grid.setAttribute("aria-busy", "false");
  }
}

/* ---- filters ------------------------------------------------------------ */
document.querySelectorAll(".chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    document.querySelectorAll(".chip").forEach((c) => c.classList.remove("is-active"));
    chip.classList.add("is-active");
    state.category = chip.dataset.category;
    loadListings();
  });
});

let cityTimer;
$("city").addEventListener("input", (e) => {
  clearTimeout(cityTimer);
  cityTimer = setTimeout(() => {
    state.city = e.target.value.trim();
    loadListings();
  }, 350);
});

/* ---- form: switch fields by category ------------------------------------ */
$("f-category").addEventListener("change", (e) => {
  const cat = e.target.value;
  document.querySelector('[data-when="property"]').hidden = cat !== "property";
  document.querySelector('[data-when="vehicle"]').hidden = cat !== "vehicle";
});

/* ---- form: upload photo straight to S3, then save the listing ----------- */
async function uploadPhoto(file) {
  const presign = await fetch("/api/uploads/presign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename: file.name, contentType: file.type }),
  });
  if (!presign.ok) throw new Error((await presign.json()).error);
  const { key, uploadUrl } = await presign.json();

  const put = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });
  if (!put.ok) {
    const errorBody = await put.text();
    throw new Error(`The photo could not be uploaded to storage. ${errorBody}`);
  }
  return key;
}

$("submit").addEventListener("click", async () => {
  const note = $("form-note");
  const btn = $("submit");
  note.className = "form-note";
  note.textContent = "";

  const category = $("f-category").value;
  const body = {
    category,
    title: $("f-title").value,
    description: $("f-description").value,
    price: $("f-price").value,
    city: $("f-city").value,
    district: $("f-district").value || undefined,
    contactName: $("f-name").value,
    contactPhone: $("f-phone").value,
    images: [],
  };

  if (category === "property") {
    body.bedrooms = $("f-bedrooms").value || undefined;
    body.bathrooms = $("f-bathrooms").value || undefined;
    body.areaSqm = $("f-area").value || undefined;
  } else {
    body.make = $("f-make").value || undefined;
    body.model = $("f-model").value || undefined;
    body.year = $("f-year").value || undefined;
  }

  btn.disabled = true;
  btn.textContent = "Publishing…";

  try {
    const file = $("f-photo").files[0];
    if (file) {
      note.textContent = "Uploading photo…";
      body.images = [await uploadPhoto(file)];
    }

    const r = await fetch("/api/listings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || "The listing could not be saved.");

    note.className = "form-note is-ok";
    note.textContent = "Published. Your listing is now at the top of the page.";
    ["f-title", "f-description", "f-price", "f-city", "f-district", "f-name", "f-phone"].forEach(
      (id) => ($(id).value = "")
    );
    $("f-photo").value = "";
    await Promise.all([loadListings(), loadStats()]);
  } catch (err) {
    note.className = "form-note is-error";
    note.textContent = err.message;
  } finally {
    btn.disabled = false;
    btn.textContent = "Publish listing";
  }
});

/* ---- go ----------------------------------------------------------------- */
loadLedger();
loadStats();
loadListings();
