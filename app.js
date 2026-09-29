const RATE_COLORS = { 7: "#718c50", 10: "#358b70", 12: "#328c9a", 14: "#4b74a8", 16: "#745fa1", 18: "#a15e83", 20: "#bd7047" };
const money = new Intl.NumberFormat("he-IL");
const search = document.querySelector("#search");
const tbody = document.querySelector("#town-rows");
const count = document.querySelector("#result-count");
const mapCount = document.querySelector("#map-count");
const empty = document.querySelector("#empty-state");
const sortButton = document.querySelector("#sort-rate");
const markers = new Map();
let towns = [];
let direction = -1;
let selectedCode = null;
let map;

function normalized(value) {
  return value.toLocaleLowerCase("he-IL").replace(/[\s׳״'"()־-]/g, "");
}

function addLegend() {
  const legend = document.querySelector("#legend");
  [...new Set(towns.map((town) => town.rate))].sort((a, b) => a - b).forEach((rate) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "legend-item";
    item.setAttribute("aria-pressed", "true");
    const dot = document.createElement("span");
    dot.className = "legend-dot";
    dot.style.background = RATE_COLORS[rate];
    item.append(dot, document.createTextNode(`${rate}%`));
    item.addEventListener("click", () => {
      const on = item.getAttribute("aria-pressed") !== "false";
      item.setAttribute("aria-pressed", String(!on));
      markers.forEach((marker) => {
        if (marker.options.rate === rate) on ? map.removeLayer(marker) : marker.addTo(map);
      });
    });
    legend.append(item);
  });
}

function renderTable() {
  const query = normalized(search.value.trim());
  const shown = towns.filter((town) => normalized(town.name).includes(query));
  shown.sort((a, b) => direction * (a.rate - b.rate) || a.name.localeCompare(b.name, "he"));
  tbody.replaceChildren();
  const fragment = document.createDocumentFragment();
  for (const town of shown) {
    const row = document.createElement("tr");
    row.dataset.id = town.id;
    row.dataset.hasCoords = String(Boolean(town.lat && town.lon));
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
    place.disabled = !town.lat || !town.lon;
    place.innerHTML = '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"></path><circle cx="12" cy="10" r="2.5"></circle></svg>';
    placeCell.append(place);
    row.append(nameCell, rateCell, capCell, maxCreditCell, placeCell);
    row.addEventListener("click", (event) => {
      if (event.target.closest("button") && !event.target.closest("button").disabled) focusTown(town);
      else focusTown(town);
    });
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
    map.setView(marker.getLatLng(), Math.max(map.getZoom(), 10), { animate: true });
    marker.openPopup();
  }
}

function initMap() {
  if (!window.L) {
    document.querySelector("#map-message").hidden = false;
    document.querySelector("#map-message").textContent = "המפה לא נטענה. אפשר להשתמש בטבלה ובחיפוש.";
    return;
  }
  map = L.map("map", { scrollWheelZoom: false }).setView([31.4, 35.05], 7);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);
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
  mapCount.textContent = `${money.format(bounds.length)} מתוך ${money.format(towns.length)} יישובים מוצגים`;
  if (bounds.length < towns.length) {
    const message = document.querySelector("#map-message");
    message.hidden = false;
    message.textContent = "חלק מהמיקומים חסרים בקובץ היישובים הרשמי; כל היישובים מופיעים בטבלה.";
  }
}

sortButton.addEventListener("click", () => {
  direction *= -1;
  sortButton.querySelector(".sort-indicator").textContent = direction < 0 ? "↓" : "↑";
  sortButton.closest("th").setAttribute("aria-sort", direction < 0 ? "descending" : "ascending");
  renderTable();
});
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
    addLegend();
    renderTable();
    initMap();
  })
  .catch(() => {
    document.querySelector("#map-message").hidden = false;
    document.querySelector("#map-message").textContent = "לא ניתן לטעון את הנתונים. כדאי לפתוח את האתר דרך שרת מקומי.";
  });
