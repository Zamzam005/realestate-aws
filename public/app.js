const CDN = "https://da7iev0eznc8q.cloudfront.net";

const $ = (selector, root = document) => root.querySelector(selector);

const state = {
  propertyItems: [],
  vehicleItems: [],
};

const HOUSE_GLYPH = `
  <svg viewBox="0 0 24 24" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 11.5L12 4l9 7.5v8.5h-5v-6H8v6H3v-8.5Z" fill="currentColor"/>
  </svg>
`;

const CAR_GLYPH = `
  <svg viewBox="0 0 24 24" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
    <path d="M4 14.5 6 9.2A2 2 0 0 1 7.9 8h8.2a2 2 0 0 1 1.9 1.2l2 5.3a2 2 0 0 1-1.9 2.8H5.9a2 2 0 0 1-1.9-2.8Zm2.5-6.5h10l1.1 2.5H5.4L6.5 8Zm-1.5 8.2a1.7 1.7 0 1 0 0 3.4 1.7 1.7 0 0 0 0-3.4Zm13.5 0a1.7 1.7 0 1 0 0 3.4 1.7 1.7 0 0 0 0-3.4Z" fill="currentColor"/>
  </svg>
`;

const routeTitles = {
  "/": "RealEstate — property and vehicles across Somalia",
  "/property": "Property — RealEstate Somalia",
  "/cars": "Cars — RealEstate Somalia",
  "/about": "About — RealEstate Somalia",
  "/contact": "Contact — RealEstate Somalia",
};

function normalizePath(pathname) {
  const value = pathname || "/";
  if (value.length > 1 && value.endsWith("/")) {
    return value.slice(0, -1);
  }
  return value;
}

const money = (n, currency) => {
  const value = Number(n || 0).toLocaleString("en-US");
  return currency === "SOS" ? `Sh ${value}` : `$${value}`;
};

const esc = (value) =>
  String(value ?? "").replace(/[&<>\"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char]));

function makePlaceholderSvg(color) {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180" role="img" aria-label="Listing image placeholder">
      <defs>
        <pattern id="diag" width="12" height="12" patternUnits="userSpaceOnUse">
          <path d="M0 12L12 0M-1 1l14 14M11 12l2 2" stroke="${color}" stroke-width="1.1" opacity="0.5"/>
        </pattern>
      </defs>
      <rect width="320" height="180" fill="#EDF2EF"/>
      <rect width="320" height="180" fill="url(#diag)"/>
      <rect x="24" y="30" width="272" height="120" fill="${color}" opacity="0.08"/>
    </svg>
  `;
}

function svgDataUri(svgMarkup) {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svgMarkup)}`;
}

function imageUrl(key) {
  if (!key) return null;
  const clean = String(key).replace(/^\/+/, "");
  return `${CDN}/${clean}`;
}

function firstImageKey(item) {
  const images = Array.isArray(item?.images) ? item.images : [];
  const first = images.find((value) => typeof value === "string" && value.trim().length > 0);
  return first || null;
}

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
  return rows;
}

function cardMedia(item) {
  const color = item.category === "property" ? "#11705C" : "#4189DD";
  const key = firstImageKey(item);

  if (!key) {
    return `
      <div class="card__media">
        ${makePlaceholderSvg(color)}
      </div>
    `;
  }

  return `
    <div class="card__media">
      <img
        src="${imageUrl(key)}"
        alt="${esc(item.title || "Listing image") }"
        width="640"
        height="360"
        loading="lazy"
        onerror="this.onerror=null;this.src='${svgDataUri(makePlaceholderSvg(color))}'"
      />
    </div>
  `;
}

function cardTemplate(item) {
  const isProperty = item.category === "property";
  const tag = isProperty ? "Property" : "Vehicle";
  const glyph = isProperty ? HOUSE_GLYPH : CAR_GLYPH;
  const place = [item.district, item.city].filter(Boolean).join(", ");
  const rows = specsFor(item);

  return `
    <article class="card" data-category="${item.category}" data-id="${esc(item.listingId || "")}">
      ${cardMedia(item)}
      <div class="card__inner">
        <div class="card__meta">
          <span class="card__tag"><span class="card__glyph" aria-hidden="true">${glyph}</span>${tag}</span>
          <span class="card__ref">${esc(String(item.listingId || "").slice(0, 8))}</span>
        </div>
        <div>
          <h3 class="card__title">${esc(item.title)}</h3>
        </div>
        <p class="card__desc">${esc(item.description || "")}</p>
        <p class="card__price">${money(item.price, item.currency)}</p>
        <p class="card__place">${esc(place)}</p>

        ${rows.length ? `
          <dl class="specs">
            ${rows.map(([key, value]) => `
              <div class="specs__item">
                <dt class="specs__key">${esc(key)}</dt>
                <dd class="specs__value">${esc(value)}</dd>
              </div>
            `).join("")}
          </dl>
        ` : ""}

        <div class="card__footer">
          <span class="card__contact">${esc(item.contactName || "Owner")}</span>
          <a class="card__tel" href="tel:${esc(String(item.contactPhone || "").replace(/\s/g, ""))}">${esc(item.contactPhone || "Call")}</a>
        </div>
      </div>
    </article>
  `;
}

async function loadLedger() {
  try {
    const response = await fetch("/api/meta");
    const meta = await response.json();
    const instance = $("#ledger-instance");
    const zone = $("#ledger-az");
    if (instance) instance.textContent = meta.instanceId || "unavailable";
    if (zone) zone.textContent = meta.availabilityZone || "—";
  } catch {
    const instance = $("#ledger-instance");
    if (instance) instance.textContent = "unavailable";
  }
}

async function loadStats() {
  try {
    const response = await fetch("/api/stats");
    const stats = await response.json();
    const map = {
      "stat-total": stats.total,
      "stat-property": stats.property,
      "stat-vehicle": stats.vehicle,
      "stat-cities": stats.cities,
    };
    Object.entries(map).forEach(([id, value]) => {
      const node = document.getElementById(id);
      if (node) node.textContent = value ?? "—";
    });
  } catch {
    // leave the placeholders alone
  }
}

function updateNav(route) {
  const currentPath = normalizePath(route);
  document.querySelectorAll(".masthead__nav a").forEach((link) => {
    const isActive = normalizePath(link.dataset.route) === currentPath;
    link.classList.toggle("is-active", isActive);
    if (isActive) {
      link.setAttribute("aria-current", "page");
    } else {
      link.removeAttribute("aria-current");
    }
  });
}

function homePage() {
  return `
    <section class="page">
      <section class="hero">
        <div class="hero__content">
          <div>
            <p class="eyebrow">Property &amp; vehicles · Somalia</p>
            <h1>Every house, shop and car worth seeing, in one place.</h1>
          </div>
          <p class="lede">Owners post directly. Buyers call directly. No agent fees in between. Search by city, compare prices in the open, and reach the person who actually holds the keys.</p>
          <div class="hero__actions">
            <a class="btn btn--primary" href="/property">Browse property</a>
            <a class="btn btn--line" href="/cars">Browse cars</a>
          </div>
        </div>

        <div class="hero__visual">
          <img
            src="${CDN}/site/hero.jpg"
            alt="Modern homes and development in Mogadishu"
            width="800"
            height="1000"
            loading="eager"
            fetchpriority="high"
            onerror="this.onerror=null;this.src='${svgDataUri(makePlaceholderSvg("#11705C"))}'"
          />
        </div>
      </section>

      <section aria-label="Marketplace totals" class="stats-grid">
        <div class="stat-box"><span class="stat-box__label">Total listings</span><strong id="stat-total">—</strong></div>
        <div class="stat-box"><span class="stat-box__label">Property</span><strong id="stat-property">—</strong></div>
        <div class="stat-box"><span class="stat-box__label">Vehicles</span><strong id="stat-vehicle">—</strong></div>
        <div class="stat-box"><span class="stat-box__label">Cities</span><strong id="stat-cities">—</strong></div>
      </section>

      <section class="page__section" style="margin-top: 2.5rem;">
        <div class="section-head">
          <div>
            <p class="eyebrow">Featured</p>
            <h2>Fresh listings</h2>
          </div>
          <a class="btn btn--ghost" href="/property">See all</a>
        </div>
        <div id="featured-grid" class="featured-grid"></div>
      </section>
    </section>
  `;
}

function propertyPage() {
  return `
    <section class="page">
      <div class="section-head">
        <div>
          <p class="eyebrow">Property</p>
          <h1>Homes, shops and land</h1>
        </div>
      </div>

      <div class="page-shell">
        <div class="panel">
          <div class="search-wrap" aria-label="Search by city">
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><path d="M10.5 3a7.5 7.5 0 0 1 5.95 12.45l4.25 4.25 1.41-1.41-4.25-4.25A7.5 7.5 0 1 1 10.5 3Zm0 2a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11Z" fill="currentColor"/></svg>
            <input id="property-search" type="search" placeholder="Search by city" aria-label="Search property listings by city" />
          </div>
          <div id="property-grid" class="card-grid"></div>
        </div>

        <aside class="panel">
          <h2>List a property</h2>
          <form id="property-form" novalidate>
            <div class="form-grid">
              <div class="field field--full">
                <label for="property-title">Title</label>
                <input id="property-title" name="title" type="text" placeholder="3-bedroom house with compound, Hodan" required />
              </div>
              <div class="field field--full">
                <label for="property-description">Description</label>
                <textarea id="property-description" name="description" placeholder="Condition, water and power, documents available" required></textarea>
              </div>
              <div class="field">
                <label for="property-price">Price</label>
                <input id="property-price" name="price" type="number" min="1" placeholder="45000" required />
              </div>
              <div class="field">
                <label for="property-city">City</label>
                <input id="property-city" name="city" type="text" placeholder="Mogadishu" required />
              </div>
              <div class="field">
                <label for="property-district">District</label>
                <input id="property-district" name="district" type="text" placeholder="Hodan" />
              </div>
              <div class="field">
                <label for="property-bedrooms">Bedrooms</label>
                <input id="property-bedrooms" name="bedrooms" type="number" min="0" placeholder="3" />
              </div>
              <div class="field">
                <label for="property-bathrooms">Bathrooms</label>
                <input id="property-bathrooms" name="bathrooms" type="number" min="0" placeholder="2" />
              </div>
              <div class="field">
                <label for="property-area">Area (m²)</label>
                <input id="property-area" name="areaSqm" type="number" min="0" placeholder="240" />
              </div>
              <div class="field">
                <label for="property-name">Your name</label>
                <input id="property-name" name="contactName" type="text" placeholder="Faduma H." required />
              </div>
              <div class="field">
                <label for="property-phone">Phone</label>
                <input id="property-phone" name="contactPhone" type="tel" placeholder="+252 61 555 0142" required />
              </div>
              <div class="field field--full">
                <label for="property-photo">Photo</label>
                <input id="property-photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp" />
              </div>
            </div>
            <button class="btn btn--primary" type="submit">Publish listing</button>
            <p class="form-note" id="property-note" role="status" aria-live="polite"></p>
          </form>
        </aside>
      </div>
    </section>
  `;
}

function carsPage() {
  return `
    <section class="page">
      <div class="section-head">
        <div>
          <p class="eyebrow">Cars</p>
          <h1>Cars, pickups and transport</h1>
        </div>
      </div>

      <div class="page-shell">
        <div class="panel">
          <div class="search-wrap" aria-label="Search by make or city">
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><path d="M10.5 3a7.5 7.5 0 0 1 5.95 12.45l4.25 4.25 1.41-1.41-4.25-4.25A7.5 7.5 0 1 1 10.5 3Zm0 2a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11Z" fill="currentColor"/></svg>
            <input id="vehicle-search" type="search" placeholder="Search by make or city" aria-label="Search vehicle listings by make or city" />
          </div>
          <div id="vehicle-grid" class="card-grid"></div>
        </div>

        <aside class="panel">
          <h2>List a vehicle</h2>
          <form id="vehicle-form" novalidate>
            <div class="form-grid">
              <div class="field field--full">
                <label for="vehicle-title">Title</label>
                <input id="vehicle-title" name="title" type="text" placeholder="Toyota Noah, clean and reliable" required />
              </div>
              <div class="field field--full">
                <label for="vehicle-description">Description</label>
                <textarea id="vehicle-description" name="description" placeholder="Condition, water and power, documents available" required></textarea>
              </div>
              <div class="field">
                <label for="vehicle-price">Price</label>
                <input id="vehicle-price" name="price" type="number" min="1" placeholder="45000" required />
              </div>
              <div class="field">
                <label for="vehicle-city">City</label>
                <input id="vehicle-city" name="city" type="text" placeholder="Mogadishu" required />
              </div>
              <div class="field">
                <label for="vehicle-district">District</label>
                <input id="vehicle-district" name="district" type="text" placeholder="Hodan" />
              </div>
              <div class="field">
                <label for="vehicle-make">Make</label>
                <input id="vehicle-make" name="make" type="text" placeholder="Toyota" required />
              </div>
              <div class="field">
                <label for="vehicle-model">Model</label>
                <input id="vehicle-model" name="model" type="text" placeholder="Noah" required />
              </div>
              <div class="field">
                <label for="vehicle-year">Year</label>
                <input id="vehicle-year" name="year" type="number" min="1950" max="2035" placeholder="2014" required />
              </div>
              <div class="field">
                <label for="vehicle-mileage">Mileage (km)</label>
                <input id="vehicle-mileage" name="mileageKm" type="number" min="0" placeholder="118000" />
              </div>
              <div class="field">
                <label for="vehicle-fuel">Fuel</label>
                <input id="vehicle-fuel" name="fuel" type="text" placeholder="Petrol" />
              </div>
              <div class="field">
                <label for="vehicle-name">Your name</label>
                <input id="vehicle-name" name="contactName" type="text" placeholder="Faduma H." required />
              </div>
              <div class="field">
                <label for="vehicle-phone">Phone</label>
                <input id="vehicle-phone" name="contactPhone" type="tel" placeholder="+252 61 555 0142" required />
              </div>
              <div class="field field--full">
                <label for="vehicle-photo">Photo</label>
                <input id="vehicle-photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp" />
              </div>
            </div>
            <button class="btn btn--primary" type="submit">Publish listing</button>
            <p class="form-note" id="vehicle-note" role="status" aria-live="polite"></p>
          </form>
        </aside>
      </div>
    </section>
  `;
}

function aboutPage() {
  return `
    <section class="page">
      <div class="section-head">
        <div>
          <p class="eyebrow">About</p>
          <h1>A local marketplace built for direct trust</h1>
        </div>
      </div>

      <div class="about-layout">
        <div>
          <p class="lede">RealEstate brings buyers and sellers together without middlemen. Owners list homes, land, shops and vehicles in the cities they know best, while buyers can compare prices and call the owner directly.</p>
          <ol class="steps">
            <li><span class="step-num">1</span><div><strong>List</strong><br />Owners post a property or vehicle with clear details and a direct phone number.</div></li>
            <li><span class="step-num">2</span><div><strong>Search</strong><br />Buyers filter by city, neighborhood and category to narrow the best matches.</div></li>
            <li><span class="step-num">3</span><div><strong>Connect</strong><br />Calls happen directly between buyer and seller, with no extra fees or agent markup.</div></li>
          </ol>
        </div>

        <div class="about-visual">
          <img
            src="${CDN}/site/about.jpg"
            alt="Marketplace overview and mobile listings in Somalia"
            width="640"
            height="800"
            loading="lazy"
            onerror="this.onerror=null;this.src='${svgDataUri(makePlaceholderSvg("#11705C"))}'"
          />
        </div>
      </div>

      <p class="lede" style="margin-top: 1.5rem;">Built on AWS across two Availability Zones.</p>
    </section>
  `;
}

function contactPage() {
  return `
    <section class="page">
      <div class="section-head">
        <div>
          <p class="eyebrow">Contact</p>
          <h1>Talk with the team</h1>
        </div>
      </div>

      <div class="contact-layout">
        <aside class="contact-card">
          <h2>Reach us</h2>
          <ul class="contact-list">
            <li><strong>Phone:</strong> <a href="tel:+252615550142">+252 61 555 0142</a></li>
            <li><strong>Email:</strong> <a href="mailto:info@realestate.so">info@realestate.so</a></li>
            <li><strong>Office:</strong> Hodan District, Mogadishu, Somalia</li>
          </ul>
        </aside>

        <div class="panel">
          <form id="contact-form" novalidate>
            <div class="form-grid">
              <div class="field">
                <label for="contact-name">Name</label>
                <input id="contact-name" name="name" type="text" placeholder="Your name" />
              </div>
              <div class="field">
                <label for="contact-email">Email</label>
                <input id="contact-email" name="email" type="email" placeholder="you@example.com" />
              </div>
              <div class="field field--full">
                <label for="contact-message">Message</label>
                <textarea id="contact-message" name="message" placeholder="How can we help?"></textarea>
              </div>
            </div>
            <button class="btn btn--primary" type="submit">Send message</button>
            <p class="form-note" id="contact-note" role="status" aria-live="polite"></p>
          </form>
        </div>
      </div>
    </section>
  `;
}

const pageMap = {
  "/": homePage,
  "/property": propertyPage,
  "/cars": carsPage,
  "/about": aboutPage,
  "/contact": contactPage,
};

function renderRoute() {
  const path = normalizePath(window.location.pathname || "/");
  const template = pageMap[path] || pageMap["/"];
  document.title = routeTitles[path] || routeTitles["/"];
  $("#app").innerHTML = template();
  updateNav(path);

  if (path === "/") {
    loadStats();
    loadFeaturedListings();
  }

  if (path === "/property") {
    loadPropertyListings();
    bindPropertyForm();
  }

  if (path === "/cars") {
    loadVehicleListings();
    bindVehicleForm();
  }

  if (path === "/contact") {
    bindContactForm();
  }
}

async function loadFeaturedListings() {
  const grid = $("#featured-grid");
  if (!grid) return;

  grid.innerHTML = '<p class="state">Loading featured listings…</p>';

  try {
    const response = await fetch("/api/listings?limit=3");
    if (!response.ok) throw new Error("bad response");
    const { items = [] } = await response.json();
    const featured = items.slice(0, 3);
    grid.innerHTML = featured.length ? featured.map(cardTemplate).join("") : '<p class="state">Featured listings will appear here soon.</p>';
    wireCardClicks();
  } catch {
    grid.innerHTML = '<p class="state">Featured listings are unavailable right now.</p>';
  }
}

async function loadPropertyListings(searchTerm = "") {
  const grid = $("#property-grid");
  if (!grid) return;

  grid.innerHTML = '<p class="state">Loading listings…</p>';

  try {
    const response = await fetch("/api/listings?category=property");
    if (!response.ok) throw new Error("bad response");
    const { items = [] } = await response.json();
    state.propertyItems = items;
    renderFilteredGrid(grid, items, searchTerm, "property");
  } catch {
    grid.innerHTML = '<p class="state">Property listings could not be loaded.</p>';
  }
}

async function loadVehicleListings(searchTerm = "") {
  const grid = $("#vehicle-grid");
  if (!grid) return;

  grid.innerHTML = '<p class="state">Loading listings…</p>';

  try {
    const response = await fetch("/api/listings?category=vehicle");
    if (!response.ok) throw new Error("bad response");
    const { items = [] } = await response.json();
    state.vehicleItems = items;
    renderFilteredGrid(grid, items, searchTerm, "vehicle");
  } catch {
    grid.innerHTML = '<p class="state">Vehicle listings could not be loaded.</p>';
  }
}

function renderFilteredGrid(container, items, term, category) {
  const needle = term.trim().toLowerCase();
  const filtered = !needle
    ? items
    : items.filter((item) => {
        const haystack = [item.city, item.district, item.title, item.make, item.model].filter(Boolean).join(" ").toLowerCase();
        return haystack.includes(needle);
      });

  if (!filtered.length) {
    container.innerHTML = `<p class="state">No ${category} listings match that search.</p>`;
    return;
  }

  container.innerHTML = filtered.map(cardTemplate).join("");
  wireCardClicks();
}

function bindPropertyForm() {
  const searchInput = $("#property-search");
  if (searchInput) {
    searchInput.addEventListener("input", (event) => {
      loadPropertyListings(event.target.value);
    });
  }

  const form = $("#property-form");
  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const note = $("#property-note");
    const payload = {
      category: "property",
      title: $("#property-title").value.trim(),
      description: $("#property-description").value.trim(),
      price: $("#property-price").value,
      city: $("#property-city").value.trim(),
      district: $("#property-district").value.trim() || undefined,
      bedrooms: $("#property-bedrooms").value || undefined,
      bathrooms: $("#property-bathrooms").value || undefined,
      areaSqm: $("#property-area").value || undefined,
      contactName: $("#property-name").value.trim(),
      contactPhone: $("#property-phone").value.trim(),
      images: [],
    };

    if (!payload.title || !payload.description || !payload.price || !payload.city || !payload.contactName || !payload.contactPhone) {
      note.className = "form-note is-error";
      note.textContent = "Please complete all required property fields.";
      return;
    }

    const file = $("#property-photo").files[0];
    try {
      if (file) payload.images = [await uploadPhoto(file, note)];
      const response = await fetch("/api/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "The property could not be saved.");
      note.className = "form-note is-ok";
      note.textContent = "Your property listing is live.";
      form.reset();
      await Promise.all([loadPropertyListings(), loadStats()]);
    } catch (error) {
      note.className = "form-note is-error";
      note.textContent = error.message;
    }
  });
}

function bindVehicleForm() {
  const searchInput = $("#vehicle-search");
  if (searchInput) {
    searchInput.addEventListener("input", (event) => {
      loadVehicleListings(event.target.value);
    });
  }

  const form = $("#vehicle-form");
  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const note = $("#vehicle-note");
    const payload = {
      category: "vehicle",
      title: $("#vehicle-title").value.trim(),
      description: $("#vehicle-description").value.trim(),
      price: $("#vehicle-price").value,
      city: $("#vehicle-city").value.trim(),
      district: $("#vehicle-district").value.trim() || undefined,
      make: $("#vehicle-make").value.trim(),
      model: $("#vehicle-model").value.trim(),
      year: $("#vehicle-year").value || undefined,
      mileageKm: $("#vehicle-mileage").value || undefined,
      fuel: $("#vehicle-fuel").value.trim() || undefined,
      contactName: $("#vehicle-name").value.trim(),
      contactPhone: $("#vehicle-phone").value.trim(),
      images: [],
    };

    if (!payload.title || !payload.description || !payload.price || !payload.city || !payload.make || !payload.model || !payload.contactName || !payload.contactPhone) {
      note.className = "form-note is-error";
      note.textContent = "Please complete all required vehicle fields.";
      return;
    }

    const file = $("#vehicle-photo").files[0];
    try {
      if (file) payload.images = [await uploadPhoto(file, note)];
      const response = await fetch("/api/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "The vehicle could not be saved.");
      note.className = "form-note is-ok";
      note.textContent = "Your vehicle listing is live.";
      form.reset();
      await Promise.all([loadVehicleListings(), loadStats()]);
    } catch (error) {
      note.className = "form-note is-error";
      note.textContent = error.message;
    }
  });
}

function bindContactForm() {
  const form = $("#contact-form");
  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submitButton = form.querySelector("button[type='submit']");
    const note = $("#contact-note");
    const name = $("#contact-name").value.trim();
    const email = $("#contact-email").value.trim();
    const message = $("#contact-message").value.trim();

    if (name.length < 2 || name.length > 80) {
      note.className = "form-note is-error";
      note.textContent = "Please enter a name between 2 and 80 characters.";
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 120) {
      note.className = "form-note is-error";
      note.textContent = "Please enter a valid email address up to 120 characters.";
      return;
    }
    if (message.length < 10 || message.length > 2000) {
      note.className = "form-note is-error";
      note.textContent = "Please add a message between 10 and 2000 characters.";
      return;
    }

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "Sending...";
    }
    note.className = "form-note";
    note.textContent = "";

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, message }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not send your message.");

      note.className = "form-note is-ok";
      note.textContent = "Thanks — your message has been received.";
      form.reset();
    } catch (error) {
      note.className = "form-note is-error";
      note.textContent = error.message || "Could not send your message.";
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = "Send message";
      }
    }
  });
}

async function uploadPhoto(file, note = null) {
  try {
    console.log("[upload] requesting presigned URL", { name: file.name, type: file.type });
    const presignResponse = await fetch("/api/uploads/presign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename: file.name, contentType: file.type }),
    });

    const presignText = await presignResponse.text();
    console.log("[upload] presign status", presignResponse.status, presignText);

    if (!presignResponse.ok) {
      const message = `Presign failed (${presignResponse.status}): ${presignText || "empty response body"}`;
      if (note) {
        note.className = "form-note is-error";
        note.textContent = message;
      }
      throw new Error(message);
    }

    let presignData;
    try {
      presignData = JSON.parse(presignText);
    } catch {
      const message = `Presign response was not valid JSON: ${presignText || "empty response body"}`;
      if (note) {
        note.className = "form-note is-error";
        note.textContent = message;
      }
      throw new Error(message);
    }

    const { key, uploadUrl } = presignData;
    console.log("[upload] presign success", { key, uploadUrl });

    const putResponse = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type },
      body: file,
    });

    const s3Body = await putResponse.text();
    console.log("[upload] S3 PUT status", putResponse.status, s3Body);

    if (!putResponse.ok) {
      const message = `S3 upload failed (${putResponse.status}): ${s3Body || "empty response body"}`;
      if (note) {
        note.className = "form-note is-error";
        note.textContent = message;
      }
      throw new Error(message);
    }

    console.log("[upload] successful S3 PUT", { key });
    return key;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[upload] error:", message);
    if (note && !note.textContent) {
      note.className = "form-note is-error";
      note.textContent = message;
    }
    throw error;
  }
}

function buildSpecs(item) {
  const rows = specsFor(item);
  if (!rows.length) return "";
  return `
    <dl class="lightbox__specs">
      ${rows.map(([key, value]) => `
        <div>
          <dt>${esc(key)}</dt>
          <dd>${esc(value)}</dd>
        </div>
      `).join("")}
    </dl>
  `;
}

function openLightbox(item) {
  const box = $("#lightbox");
  if (!box) return;

  const color = item.category === "property" ? "#11705C" : "#4189DD";
  const key = firstImageKey(item);
  const image = key ? imageUrl(key) : svgDataUri(makePlaceholderSvg(color));

  const specs = buildSpecs(item);
  box.hidden = false;
  box.setAttribute("aria-hidden", "false");
  document.body.classList.add("lightbox-open");

  const focusTarget = document.activeElement;

  box.innerHTML = `
    <div class="lightbox__dialog" role="dialog" aria-modal="true" aria-label="${esc(item.title || "Listing image")}">
      <button class="lightbox__close" type="button" aria-label="Close image">×</button>
      <div class="lightbox__image">
        <img
          src="${image}"
          alt="${esc(item.title || "Listing image") }"
          width="960"
          height="720"
          onerror="this.onerror=null;this.src='${svgDataUri(makePlaceholderSvg(item.category === "property" ? "#11705C" : "#4189DD"))}'"
        />
      </div>
      <div class="lightbox__content">
        <p class="lightbox__tag">${item.category === "property" ? "Property" : "Vehicle"}</p>
        <h2 class="lightbox__title">${esc(item.title)}</h2>
        <p class="lightbox__price">${money(item.price, item.currency)}</p>
        <p class="lightbox__description">${esc(item.description || "")}</p>
        ${specs}
        <a class="lightbox__tel" href="tel:${esc(String(item.contactPhone || "").replace(/\s/g, ""))}">Call ${esc(item.contactPhone || "owner")}</a>
      </div>
    </div>
  `;

  const closeButton = box.querySelector(".lightbox__close");
  closeButton.focus();

  closeButton.addEventListener("click", () => closeLightbox(focusTarget));
  box.addEventListener("click", (event) => {
    if (event.target === box) closeLightbox(focusTarget);
  });

  document.addEventListener("keydown", trapLightboxFocus);
}

function trapLightboxFocus(event) {
  const box = $("#lightbox");
  if (box.hidden || event.key !== "Tab") return;

  const focusable = box.querySelectorAll("button, a, input, textarea, select");
  if (!focusable.length) return;

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const active = document.activeElement;

  if (event.shiftKey && active === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
}

function closeLightbox(returnFocus = null) {
  const box = $("#lightbox");
  if (!box) return;
  box.hidden = true;
  box.setAttribute("aria-hidden", "true");
  box.innerHTML = "";
  document.body.classList.remove("lightbox-open");
  document.removeEventListener("keydown", trapLightboxFocus);
  if (returnFocus && typeof returnFocus.focus === "function") returnFocus.focus();
}

function wireCardClicks() {
  document.querySelectorAll(".card").forEach((card) => {
    card.addEventListener("click", (event) => {
      if (event.target.closest("a")) return;
      const id = card.dataset.id;
      const category = card.dataset.category;
      const source = category === "property" ? state.propertyItems : state.vehicleItems;
      const item = source.find((entry) => String(entry.listingId) === String(id));
      if (item) openLightbox(item);
    });
  });
}

function bindNavigation() {
  document.addEventListener("click", (event) => {
    const link = event.target.closest("[data-route]");
    if (!link) return;
    const route = normalizePath(link.dataset.route);

    if (route === normalizePath(window.location.pathname || "/")) {
      event.preventDefault();
      return;
    }

    event.preventDefault();
    history.pushState({}, "", route);
    renderRoute();
  });

  window.addEventListener("popstate", () => renderRoute());
}

function start() {
  bindNavigation();
  renderRoute();
  loadLedger();
}

start();
