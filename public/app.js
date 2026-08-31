/* RealEstate — front end. Talks only to the app's own API on the ALB. */

const CDN_DOMAIN = "https://da7iev0eznc8q.cloudfront.net";
const $ = (id) => document.getElementById(id);

// SVG glyphs for cards
const SVG_HOUSE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9L12 2l9 7v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>';
const SVG_CAR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="6" cy="17" r="2"/><circle cx="18" cy="17" r="2"/><path d="M3 6h18M5 6L7 3h10l2 3M2 12h20v5H2z"/></svg>';

// App state
const state = { currentPage: "home", listings: {}, filters: {} };

/* ---- routing ------------------------------------------------------------ */
function navigate(href) {
  const path = new URL(href, window.location).pathname;
  window.history.pushState({ path }, "", href);
  renderPage();
}

function renderPage() {
  const path = window.location.pathname;
  let page = "home";
  
  if (path === "/" || path === "") page = "home";
  else if (path === "/property") page = "property";
  else if (path === "/cars") page = "cars";
  else if (path === "/about") page = "about";
  else if (path === "/contact") page = "contact";
  
  state.currentPage = page;
  
  // Hide all pages
  document.querySelectorAll(".page").forEach(p => p.classList.remove("is-active"));
  
  // Show current page
  const $page = document.querySelector(`[data-page="${page}"]`);
  if ($page) $page.classList.add("is-active");
  
  // Update nav links
  document.querySelectorAll(".nav-link").forEach(link => {
    link.classList.remove("is-active");
    if (link.getAttribute("data-page") === page) {
      link.classList.add("is-active");
    }
  });
  
  // Update title
  const titles = {
    home: "RealEstate — Home",
    property: "RealEstate — Property",
    cars: "RealEstate — Vehicles",
    about: "RealEstate — About",
    contact: "RealEstate — Contact"
  };
  document.title = titles[page] || "RealEstate";
  
  // Load page-specific content
  if (page === "home") loadHome();
  else if (page === "property") loadPropertyPage();
  else if (page === "cars") loadCarsPage();
  else if (page === "contact") setupContactForm();
}

// Handle History API
window.addEventListener("popstate", renderPage);

// Handle navigation links
document.addEventListener("click", (e) => {
  const link = e.target.closest("[data-link]");
  if (link && link.href) {
    e.preventDefault();
    navigate(link.href);
  }
});

/* ---- utilities ---------------------------------------------------------- */
const money = (n, c) => (c === "SOS" ? "Sh " : "$") + Number(n).toLocaleString("en-US");

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );

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
  return rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join("");
}

function cardFor(item) {
  const place = [item.district, item.city].filter(Boolean).join(", ");
  const glyph = item.category === "property" ? SVG_HOUSE : SVG_CAR;
  const imageHtml = item.images && item.images[0]
    ? `<img src="${CDN_DOMAIN}/listings/${item.images[0]}" alt="${esc(item.title)}" width="320" height="180" loading="lazy" />`
    : `<svg class="card__placeholder card__glyph card__glyph--${item.category}" viewBox="0 0 24 24">${glyph}</svg>`;
  
  return `
    <article class="card" data-cat="${item.category}" data-id="${item.listingId}">
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
        <dl class="specs">${specsFor(item)}</dl>
      </div>
      <div class="card__foot">
        <span class="card__contact">${esc(item.contactName || "Owner")}</span>
        <a class="card__call" href="tel:${esc(String(item.contactPhone).replace(/\s/g, ""))}">${esc(item.contactPhone)}</a>
      </div>
    </article>`;
}

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

/* ---- home page ---------------------------------------------------------- */
async function loadHome() {
  loadStats();
  loadFeaturedListings();
}

async function loadFeaturedListings() {
  const grid = $("featured-grid");
  grid.innerHTML = `<p class="state">Loading…</p>`;
  
  try {
    const r = await fetch("/api/listings?limit=3");
    if (!r.ok) throw new Error("bad response");
    const { items } = await r.json();
    
    if (!items.length) {
      grid.innerHTML = `<p class="state">No listings yet.</p>`;
    } else {
      grid.innerHTML = items.slice(0, 3).map(cardFor).join("");
      setupLightbox();
    }
  } catch {
    grid.innerHTML = `<p class="state">Could not load listings.</p>`;
  }
}

/* ---- property page ------------------------------------------------------ */
async function loadPropertyPage() {
  setupPropertyFilters();
  await loadPropertyListings();
  setupPropertyForm();
}

function setupPropertyFilters() {
  const $city = $("property-city");
  const $sort = $("property-sort");
  
  let cityTimer;
  $city.addEventListener("input", (e) => {
    clearTimeout(cityTimer);
    cityTimer = setTimeout(() => {
      state.filters.propertyCity = e.target.value.trim();
      loadPropertyListings();
    }, 350);
  });
  
  $sort.addEventListener("change", (e) => {
    state.filters.propertySort = e.target.value;
    loadPropertyListings();
  });
}

async function loadPropertyListings() {
  const grid = $("property-grid");
  grid.setAttribute("aria-busy", "true");
  grid.innerHTML = `<p class="state">Loading listings…</p>`;
  
  const params = new URLSearchParams({ category: "property" });
  if (state.filters.propertyCity) params.set("city", state.filters.propertyCity);
  
  try {
    const r = await fetch(`/api/listings?${params}`);
    if (!r.ok) throw new Error("bad response");
    const { items } = await r.json();
    
    let sorted = items;
    if (state.filters.propertySort === "price-low") {
      sorted = [...items].sort((a, b) => a.price - b.price);
    } else if (state.filters.propertySort === "price-high") {
      sorted = [...items].sort((a, b) => b.price - a.price);
    }
    
    if (!sorted.length) {
      grid.innerHTML = `<p class="state">No property listings found. Try a different search.</p>`;
    } else {
      grid.innerHTML = sorted.map(cardFor).join("");
      setupLightbox();
    }
  } catch {
    grid.innerHTML = `<p class="state">Could not load listings. Check your connection.</p>`;
  } finally {
    grid.setAttribute("aria-busy", "false");
  }
}

function setupPropertyForm() {
  const btn = $("property-submit");
  btn.onclick = null;
  btn.addEventListener("click", submitPropertyListing);
}

async function submitPropertyListing() {
  const note = $("property-note");
  const btn = $("property-submit");
  note.className = "form-note";
  note.textContent = "";
  
  const body = {
    category: "property",
    title: $("property-title").value,
    description: $("property-description").value,
    price: $("property-price").value,
    city: $("property-city-field").value,
    district: $("property-district").value || undefined,
    contactName: $("property-name").value,
    contactPhone: $("property-phone").value,
    bedrooms: $("property-bedrooms").value || undefined,
    bathrooms: $("property-bathrooms").value || undefined,
    areaSqm: $("property-area").value || undefined,
    images: [],
  };
  
  btn.disabled = true;
  btn.textContent = "Publishing…";
  
  try {
    const file = $("property-photo").files[0];
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
    if (!r.ok) throw new Error(data.error || "Could not save listing.");
    
    note.className = "form-note is-ok";
    note.textContent = "Published! Your listing is live.";
    ["property-title", "property-description", "property-price", "property-city-field", "property-district", "property-name", "property-phone", "property-bedrooms", "property-bathrooms", "property-area"].forEach(
      (id) => ($(id).value = "")
    );
    $("property-photo").value = "";
    await Promise.all([loadPropertyListings(), loadStats()]);
  } catch (err) {
    note.className = "form-note is-error";
    note.textContent = err.message;
  } finally {
    btn.disabled = false;
    btn.textContent = "Publish listing";
  }
}

/* ---- cars page ---------------------------------------------------------- */
async function loadCarsPage() {
  setupCarsFilters();
  await loadCarsListings();
  setupCarsForm();
}

function setupCarsFilters() {
  const $search = $("cars-search");
  const $sort = $("cars-sort");
  
  let searchTimer;
  $search.addEventListener("input", (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.filters.carsSearch = e.target.value.trim();
      loadCarsListings();
    }, 350);
  });
  
  $sort.addEventListener("change", (e) => {
    state.filters.carsSort = e.target.value;
    loadCarsListings();
  });
}

async function loadCarsListings() {
  const grid = $("cars-grid");
  grid.setAttribute("aria-busy", "true");
  grid.innerHTML = `<p class="state">Loading listings…</p>`;
  
  const params = new URLSearchParams({ category: "vehicle" });
  
  try {
    const r = await fetch(`/api/listings?${params}`);
    if (!r.ok) throw new Error("bad response");
    let { items } = await r.json();
    
    // Filter by make or city
    if (state.filters.carsSearch) {
      const search = state.filters.carsSearch.toLowerCase();
      items = items.filter(item =>
        (item.make && item.make.toLowerCase().includes(search)) ||
        (item.model && item.model.toLowerCase().includes(search)) ||
        (item.city && item.city.toLowerCase().includes(search))
      );
    }
    
    let sorted = items;
    if (state.filters.carsSort === "price-low") {
      sorted = [...items].sort((a, b) => a.price - b.price);
    } else if (state.filters.carsSort === "price-high") {
      sorted = [...items].sort((a, b) => b.price - a.price);
    }
    
    if (!sorted.length) {
      grid.innerHTML = `<p class="state">No vehicle listings found. Try a different search.</p>`;
    } else {
      grid.innerHTML = sorted.map(cardFor).join("");
      setupLightbox();
    }
  } catch {
    grid.innerHTML = `<p class="state">Could not load listings. Check your connection.</p>`;
  } finally {
    grid.setAttribute("aria-busy", "false");
  }
}

function setupCarsForm() {
  const btn = $("cars-submit");
  btn.onclick = null;
  btn.addEventListener("click", submitCarsListing);
}

async function submitCarsListing() {
  const note = $("cars-note");
  const btn = $("cars-submit");
  note.className = "form-note";
  note.textContent = "";
  
  const body = {
    category: "vehicle",
    title: $("cars-title").value,
    description: $("cars-description").value,
    price: $("cars-price").value,
    city: $("cars-city").value,
    district: $("cars-district").value || undefined,
    contactName: $("cars-name").value,
    contactPhone: $("cars-phone").value,
    make: $("cars-make").value || undefined,
    model: $("cars-model").value || undefined,
    year: $("cars-year").value || undefined,
    mileageKm: $("cars-mileage").value || undefined,
    fuel: $("cars-fuel").value || undefined,
    images: [],
  };
  
  btn.disabled = true;
  btn.textContent = "Publishing…";
  
  try {
    const file = $("cars-photo").files[0];
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
    if (!r.ok) throw new Error(data.error || "Could not save listing.");
    
    note.className = "form-note is-ok";
    note.textContent = "Published! Your listing is live.";
    ["cars-title", "cars-description", "cars-price", "cars-city", "cars-district", "cars-name", "cars-phone", "cars-make", "cars-model", "cars-year", "cars-mileage"].forEach(
      (id) => ($(id).value = "")
    );
    $("cars-fuel").value = "";
    $("cars-photo").value = "";
    await Promise.all([loadCarsListings(), loadStats()]);
  } catch (err) {
    note.className = "form-note is-error";
    note.textContent = err.message;
  } finally {
    btn.disabled = false;
    btn.textContent = "Publish listing";
  }
}

/* ---- contact form ------------------------------------------------------- */
function setupContactForm() {
  const form = $("contact-form");
  form.onsubmit = null;
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    submitContactForm();
  });
}

function submitContactForm() {
  const note = $("contact-note");
  const name = $("contact-name").value.trim();
  const email = $("contact-email").value.trim();
  const message = $("contact-message").value.trim();
  
  // Simple validation
  if (!name || !email || !message) {
    note.className = "form-note is-error";
    note.textContent = "Please fill in all fields.";
    return;
  }
  
  if (!email.includes("@")) {
    note.className = "form-note is-error";
    note.textContent = "Please enter a valid email address.";
    return;
  }
  
  // Show confirmation
  note.className = "form-note is-ok";
  note.textContent = `Thanks ${name}! We'll be in touch soon.`;
  
  // Clear form
  $("contact-form").reset();
}

/* ---- photo upload ------------------------------------------------------- */
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
    throw new Error(`Photo upload failed. ${errorBody}`);
  }
  return key;
}

/* ---- lightbox ----------------------------------------------------------- */
function setupLightbox() {
  const lb = $("lightbox");
  const backdrop = lb.querySelector(".lightbox__backdrop");
  const closeBtn = lb.querySelector(".lightbox__close");
  
  // Card click to open lightbox
  document.querySelectorAll(".card__image").forEach(img => {
    img.addEventListener("click", (e) => {
      const card = img.closest(".card");
      const id = card.getAttribute("data-id");
      if (state.listings[id]) {
        openLightbox(state.listings[id], card.getAttribute("data-cat"));
      }
    });
  });
  
  // Close lightbox
  closeBtn.addEventListener("click", closeLightbox);
  backdrop.addEventListener("click", closeLightbox);
  
  // Escape key
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !lb.hidden) {
      closeLightbox();
    }
  });
}

function openLightbox(item, category) {
  const lb = $("lightbox");
  const img = $("lightbox-image");
  const title = $("lightbox-title");
  const desc = $("lightbox-description");
  const specs = $("lightbox-specs");
  const contact = $("lightbox-contact");
  
  // Image
  if (item.images && item.images[0]) {
    img.src = `${CDN_DOMAIN}/listings/${item.images[0]}`;
    img.alt = item.title;
  }
  
  // Content
  title.textContent = item.title;
  desc.textContent = item.description || "";
  specs.innerHTML = specsFor(item);
  contact.innerHTML = `<a href="tel:${esc(String(item.contactPhone).replace(/\s/g, ""))}">${esc(item.contactPhone)}</a> · ${esc(item.contactName || "Owner")}`;
  
  // Show
  lb.hidden = false;
  closeBtn = lb.querySelector(".lightbox__close");
  closeBtn.focus();
  
  // Lock scroll
  document.body.style.overflow = "hidden";
  
  // Focus trap
  const focusables = lb.querySelectorAll("button, a, [tabindex]");
  const firstFocus = focusables[0];
  const lastFocus = focusables[focusables.length - 1];
  
  lb.addEventListener("keydown", (e) => {
    if (e.key === "Tab") {
      if (e.shiftKey) {
        if (document.activeElement === firstFocus) {
          e.preventDefault();
          lastFocus.focus();
        }
      } else {
        if (document.activeElement === lastFocus) {
          e.preventDefault();
          firstFocus.focus();
        }
      }
    }
  });
}

function closeLightbox() {
  const lb = $("lightbox");
  lb.hidden = true;
  document.body.style.overflow = "";
}

/* ---- cache listings ----------------------------------------------------- */
async function cacheAllListings() {
  try {
    const r = await fetch("/api/listings?limit=1000");
    if (r.ok) {
      const { items } = await r.json();
      items.forEach(item => {
        state.listings[item.listingId] = item;
      });
    }
  } catch {}
}

/* ---- init -------------------------------------------------------------- */
loadLedger();
cacheAllListings();
renderPage();
