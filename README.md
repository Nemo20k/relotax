# Relotax

A small, static website for exploring Israel's 2026 locality income tax credits. The public interface is in Hebrew and has two sections: an interactive map and a searchable table with sortable data columns. There is no backend or build step.

## Run locally

From the project root:

```sh
python3 -m http.server 8000
```

Open <http://localhost:8000>. The site must be served over HTTP because the browser fetches its JSON data; opening `index.html` as a local file will not work reliably.

## Architecture

| File | Role |
| --- | --- |
| `index.html` | Hebrew, right-to-left page with the map and table sections; loads Leaflet and MapLibre GL from CDNs. |
| `styles.css` | Responsive layout and visual styling. |
| `app.js` | Fetches the static JSON, renders the Leaflet markers and table, and handles search, sorting by town, rate, income ceiling, or maximum credit, legend filters, and map/table selection. Rate sorts descending by default. |
| `data/towns-2026.json` | Generated snapshot used by the browser. Each town has an ID, name, credit rate, annual eligible-income ceiling, source/page, and optional locality code and coordinates. |
| `scripts/build_data.py` | Offline data preparation: extracts the tax tables, matches names or codes to the CBS locality register, and converts ITM coordinates to latitude/longitude. It needs `pdfplumber`; the website does not need Python. |

The data flow is: Tax Authority PDFs + CBS locality register → `build_data.py` → `data/towns-2026.json` → `app.js` → map and table. The table includes every tax row and computes the theoretical maximum credit as `rate × cap / 100`; the actual benefit is limited by eligible income and income tax owed. Towns without a verified coordinate have no map marker.

## Data and sources

The current data snapshot contains 555 entries: 491 from pages 20–32 of the [2026 monthly deductions booklet](https://www.gov.il/BlobFolder/generalpage/income-tax-monthly-deductions-booklet/he/generalInformation_income-tax-monthly-deductions-booklet_monthly-deductions-booklet-2026.pdf), 63 from the Tax Authority's 2 August 2026 eastern confrontation line locality update, and Eilat's separate benefit from booklet page 18. The [Tax Authority employer information page](https://www.gov.il/he/pages/pa090124-2) lists the locality notices. The annual ceiling is a cap on eligible income, not a guaranteed refund or a cap on the credit itself.

Map positions come from the [CBS 2023 localities file](https://data.gov.il/he/datasets/lamas/localities-in-israel). In this snapshot, 533 entries have coordinates; the other 22 remain searchable in the table. The map uses [Leaflet](https://leafletjs.com/), [MapLibre GL](https://maplibre.org/), and the [OpenFreeMap Bright](https://openfreemap.org/) style, with visible OpenFreeMap, OpenMapTiles, and OpenStreetMap attribution. Tax data is a dated snapshot and does not update automatically.

### Regenerate the JSON

Install `pdfplumber` in the Python environment used for the script. Obtain the two source PDFs and the CBS 2023 locality records in CKAN JSON format:

```sh
curl -L 'https://data.gov.il/api/3/action/datastore_search?resource_id=d47a54ff-87f0-44b3-b33a-f284c0c38e5a&limit=2000' -o /tmp/localities-2023.json
python3 scripts/build_data.py booklet.pdf locality-update.pdf /tmp/localities-2023.json data/towns-2026.json
```

The PDF arguments are local file paths. Review changes to town names, rates, ceilings, and unmatched coordinates before publishing a new snapshot. Update the displayed source date and this README when the source documents change.

## Deploy

Upload the project root to a static host, keeping `data/towns-2026.json` at the same relative path. For example, [Netlify Drop](https://docs.netlify.com/start/quickstarts/netlify-drop-quickstart/) can publish the folder directly without a build command. The map and Leaflet library require internet access in visitors' browsers.
