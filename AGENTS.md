# Project instructions

Read [README.md](README.md) before changing this project. It documents the architecture, data sources, local run steps, and deployment. Update it in the same change whenever the app's behavior, file roles, data workflow, source snapshot, or deployment steps change.

- Keep the site static and small. `index.html` owns the two-section Hebrew RTL page, `styles.css` its layout, and `app.js` its map/table behavior. Preserve the searchable table, sorting on all data columns, and map/table selection.
- Treat `data/towns-2026.json` as generated data. Change `scripts/build_data.py` and regenerate the JSON from the Tax Authority PDFs and CBS locality records rather than hand-editing rows.
- Preserve tax meaning: `rate` is the income tax credit percentage; `cap` is the annual ceiling on eligible income. Eilat uses a separate rule. Keep source/page metadata, and do not infer missing coordinates; towns without them remain in the table.
- Keep public interface copy in Hebrew and documentation in English. Keep Tax Authority, CBS, and OpenStreetMap attribution visible when changing sources or the map.
- After a data change, review row counts, names, rates, ceilings, and unmatched locations. After a UI change, check the map, table, search, sort, and mobile layout through a local HTTP server.
