import * as L from "leaflet";
import { maplibreGL } from "https://unpkg.com/@maplibre/maplibre-gl-leaflet@0.1.4/dist/leaflet-maplibre-gl.mjs";

const RATE_COLORS = { 7: "#718c50", 10: "#358b70", 12: "#328c9a", 14: "#4b74a8", 16: "#745fa1", 18: "#a15e83", 20: "#bd7047" };
const money = new Intl.NumberFormat("he-IL");
const search = document.querySelector("#search");
const tbody = document.querySelector("#town-rows");
const count = document.querySelector("#result-count");
const mapCount = document.querySelector("#map-count");
const empty = document.querySelector("#empty-state");
const sortButtons = [...document.querySelectorAll("[data-sort]")];
const markers = new Map();
let towns = [];
let sortKey = "rate";
let sortDirection = -1;
let selectedCode = null;
let map;

function normalized(value) {
  return value.toLocaleLowerCase("he-IL").replace(/[\s׳״'"()־-]/g, "");
}

function updateMapCount() {
  const visible = [...markers.values()].filter((marker) => map.hasLayer(marker)).length;
  mapCount.textContent = `${money.format(visible)} מתוך ${money.format(towns.length)} יישובים מוצגים`;
}

function setRateVisible(rate, visible) {
  document.querySelector(`.legend-item[data-rate="${rate}"]`)?.setAttribute("aria-pressed", String(visible));
  markers.forEach((marker) => {
    if (marker.options.rate === rate) visible ? marker.addTo(map) : map.removeLayer(marker);
  });
  updateMapCount();
}

function addLegend() {
  const legend = document.querySelector("#legend");
  [...new Set(towns.map((town) => town.rate))].sort((a, b) => a - b).forEach((rate) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "legend-item";
    item.dataset.rate = rate;
    item.setAttribute("aria-pressed", "true");
    const dot = document.createElement("span");
    dot.className = "legend-dot";
    dot.style.background = RATE_COLORS[rate];
    item.append(dot, document.createTextNode(`${rate}%`));
    item.addEventListener("click", () => {
      setRateVisible(rate, item.getAttribute("aria-pressed") === "false");
    });
    legend.append(item);
  });
}

function renderTable() {
  const query = normalized(search.value.trim());
  const shown = towns.filter((town) => normalized(town.name).includes(query));
  const sortValue = {
    name: (town) => town.name,
    rate: (town) => town.rate,
    cap: (town) => town.cap,
    credit: (town) => town.cap * town.rate / 100,
  }[sortKey];
  shown.sort((a, b) => {
    const left = sortValue(a);
    const right = sortValue(b);
    const order = typeof left === "string" ? left.localeCompare(right, "he") : left - right;
    return sortDirection * order || a.name.localeCompare(b.name, "he");
  });
  tbody.replaceChildren();
  const fragment = document.createDocumentFragment();
  for (const town of shown) {
    const hasCoords = Boolean(town.lat && town.lon);
    const row = document.createElement("tr");
    row.dataset.id = town.id;
    row.dataset.hasCoords = String(hasCoords);
    if (town.id === selectedCode) row.classList.add("is-selected");
    const nameCell = document.createElement("td");
    nameCell.textContent = town.name;
    const rateCell = document.createElement("td");
    const rate = document.createElement("span");
    rate.className = "rate-value";
    const dot = document.createElement("i");
    dot.className = "rate-mark";
    dot.style.background = RATE_COLORS[town.rate];
    rate.append(dot, document.createTextNode(`${town.rate}%`));
    rateCell.append(rate);
    const capCell = document.createElement("td");
    const cap = document.createElement("span");
    cap.className = "currency";
    cap.textContent = `₪${money.format(town.cap)}`;
    capCell.append(cap);
    const maxCreditCell = document.createElement("td");
    const maxCredit = document.createElement("span");
    maxCredit.className = "currency";
    maxCredit.textContent = `₪${money.format(town.cap * town.rate / 100)}`;
    maxCreditCell.append(maxCredit);
    const placeCell = document.createElement("td");
    const place = document.createElement("button");
    place.type = "button";
    place.className = "place-button";
    place.setAttribute("aria-label", `הצג ${town.name} במפה`);
    place.disabled = !hasCoords;
    place.innerHTML = '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"></path><circle cx="12" cy="10" r="2.5"></circle></svg>';
    placeCell.append(place);
    row.append(nameCell, rateCell, capCell, maxCreditCell, placeCell);
    if (hasCoords) row.addEventListener("click", () => focusTown(town));
    fragment.append(row);
  }
  tbody.append(fragment);
  empty.hidden = shown.length !== 0;
  count.textContent = `${money.format(shown.length)} יישובים`;
}

function focusTown(town) {
  selectedCode = town.id;
  document.querySelectorAll("tbody tr.is-selected").forEach((row) => row.classList.remove("is-selected"));
  const row = tbody.querySelector(`[data-id="${CSS.escape(town.id)}"]`);
  row?.classList.add("is-selected");
  const marker = markers.get(town.id);
  if (marker) {
    setRateVisible(town.rate, true);
    map.setView(marker.getLatLng(), Math.max(map.getZoom(), 10), { animate: true });
    marker.openPopup();
  }
}

function initMap() {
  map = L.map("map", { scrollWheelZoom: false }).setView([31.4, 35.05], 7);
  maplibreGL({ style: "https://tiles.openfreemap.org/styles/bright", attributionControl: false }).addTo(map);
  map.attributionControl.addAttribution('© <a href="https://openfreemap.org/">OpenFreeMap</a> · © <a href="https://openmaptiles.org/">OpenMapTiles</a> · © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>');
  const bounds = [];
  for (const town of towns) {
    if (!town.lat || !town.lon) continue;
    const color = RATE_COLORS[town.rate] || "#17634d";
    const popup = document.createElement("div");
    const popupName = document.createElement("div");
    popupName.className = "popup-name";
    popupName.textContent = town.name;
    const popupDetails = document.createElement("div");
    popupDetails.className = "popup-details";
    popupDetails.textContent = `זיכוי ${town.rate}% · תקרת הכנסה ₪${money.format(town.cap)}`;
    popup.append(popupName, popupDetails);
    const marker = L.circleMarker([town.lat, town.lon], {
      radius: 6, color: "#fff", weight: 1.5, fillColor: color, fillOpacity: .92, rate: town.rate
    }).bindPopup(popup);
    marker.addTo(map);
    marker.on("click", () => {
      selectedCode = town.id;
      const row = tbody.querySelector(`[data-id="${CSS.escape(town.id)}"]`);
      document.querySelectorAll("tbody tr.is-selected").forEach((item) => item.classList.remove("is-selected"));
      row?.classList.add("is-selected");
      row?.scrollIntoView({ block: "nearest" });
    });
    markers.set(town.id, marker);
    bounds.push([town.lat, town.lon]);
  }
  if (bounds.length) map.fitBounds(bounds, { padding: [18, 18], maxZoom: 7 });
  updateMapCount();
}

sortButtons.forEach((button) => button.addEventListener("click", () => {
  const key = button.dataset.sort;
  if (key === sortKey) sortDirection *= -1;
  else {
    sortKey = key;
    sortDirection = key === "name" ? 1 : -1;
  }
  sortButtons.forEach((item) => {
    const active = item.dataset.sort === sortKey;
    item.querySelector(".sort-indicator").hidden = !active;
    if (active) {
      item.querySelector(".sort-indicator").textContent = sortDirection < 0 ? "↓" : "↑";
      item.closest("th").setAttribute("aria-sort", sortDirection < 0 ? "descending" : "ascending");
    } else item.closest("th").removeAttribute("aria-sort");
  });
  renderTable();
}));
search.addEventListener("input", renderTable);
document.addEventListener("keydown", (event) => {
  if (event.key === "/" && !["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)) {
    event.preventDefault();
    search.focus();
  }
  if (event.key === "Escape" && document.activeElement === search) {
    search.value = "";
    renderTable();
    search.blur();
  }
});

fetch("data/towns-2026.json")
  .then((response) => { if (!response.ok) throw new Error("town data unavailable"); return response.json(); })
  .then((data) => {
    towns = data.towns;
    renderTable();
    try {
      initMap();
      addLegend();
    } catch {
      document.querySelector("#map-message").hidden = false;
      document.querySelector("#map-message").textContent = "לא ניתן להציג את המפה. הטבלה והחיפוש זמינים כרגיל.";
      mapCount.textContent = "לא ניתן להציג את המפה. הטבלה והחיפוש זמינים כרגיל.";
    }
  }, () => {
    document.querySelector("#map-message").hidden = false;
    document.querySelector("#map-message").textContent = "לא ניתן לטעון את נתוני היישובים. נסו לרענן את הדף.";
    mapCount.textContent = count.textContent = "לא ניתן לטעון את נתוני היישובים. נסו לרענן את הדף.";
  });
