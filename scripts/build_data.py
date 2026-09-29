#!/usr/bin/env python3
"""Build the static 2026 town data from the supplied PDFs and CBS register."""
import json
import math
import re
import sys
import unicodedata

import pdfplumber


def clean_name(value):
    return re.sub(r"\s+", " ", value or "").strip()[::-1]


def key(value):
    return "".join(char for char in unicodedata.normalize("NFKC", value).lower() if char.isalnum())


def itm_to_wgs84(easting, northing):
    # EPSG:2039 inverse Transverse Mercator; sufficient for locality centroids.
    a, f = 6378137.0, 1 / 298.257222101
    e2 = f * (2 - f)
    ep2 = e2 / (1 - e2)
    k0, x0, y0 = 1.0000067, 219529.584, 626907.39
    lat0, lon0 = math.radians(31.73439361111111), math.radians(35.20451694444444)
    x = easting - x0
    m0 = a * ((1 - e2 / 4 - 3 * e2**2 / 64 - 5 * e2**3 / 256) * lat0
              - (3 * e2 / 8 + 3 * e2**2 / 32 + 45 * e2**3 / 1024) * math.sin(2 * lat0)
              + (15 * e2**2 / 256 + 45 * e2**3 / 1024) * math.sin(4 * lat0)
              - 35 * e2**3 / 3072 * math.sin(6 * lat0))
    m = m0 + (northing - y0) / k0
    mu = m / (a * (1 - e2 / 4 - 3 * e2**2 / 64 - 5 * e2**3 / 256))
    e1 = (1 - math.sqrt(1 - e2)) / (1 + math.sqrt(1 - e2))
    phi1 = (mu + (3 * e1 / 2 - 27 * e1**3 / 32) * math.sin(2 * mu)
            + (21 * e1**2 / 16 - 55 * e1**4 / 32) * math.sin(4 * mu)
            + 151 * e1**3 / 96 * math.sin(6 * mu) + 1097 * e1**4 / 512 * math.sin(8 * mu))
    sin1, cos1, tan1 = math.sin(phi1), math.cos(phi1), math.tan(phi1)
    n1 = a / math.sqrt(1 - e2 * sin1**2)
    r1 = a * (1 - e2) / (1 - e2 * sin1**2)**1.5
    t1, c1 = tan1**2, ep2 * cos1**2
    d = x / (n1 * k0)
    lat = phi1 - (n1 * tan1 / r1) * (d**2 / 2 - (5 + 3*t1 + 10*c1 - 4*c1**2 - 9*ep2) * d**4 / 24
                                     + (61 + 90*t1 + 298*c1 + 45*t1**2 - 252*ep2 - 3*c1**2) * d**6 / 720)
    lon = lon0 + (d - (1 + 2*t1 + c1) * d**3 / 6
                  + (5 - 2*c1 + 28*t1 - 3*c1**2 + 8*ep2 + 24*t1**2) * d**5 / 120) / cos1
    return round(math.degrees(lat), 6), round(math.degrees(lon), 6)


def add_pdf_rows(pdf, rows, page_start, source):
    for page_index, page in enumerate(pdf.pages[page_start:], start=page_start + 1):
        tables = page.extract_tables()
        if not tables:
            continue
        for cells in tables[0][1:]:
            if len(cells) < 3 or not cells[0] or not cells[1] or not cells[2]:
                continue
            try:
                cap = int(re.sub(r"\D", "", cells[0]))
                rate = int(re.sub(r"\D", "", cells[1]))
            except ValueError:
                continue
            name = clean_name(cells[2])
            if name.startswith("(") and "\n" in cells[2]:
                name = " ".join(part.strip() for part in name.splitlines())
            rows.append({"name": name, "rate": rate, "cap": cap, "source": source, "page": page_index})


def main():
    if len(sys.argv) != 5:
        raise SystemExit("usage: build_data.py BOOKLET UPDATE CBS_LOCALITIES_JSON OUTPUT_JSON")
    booklet_path, update_path, locations_path, output_path = sys.argv[1:]
    with open(locations_path, encoding="utf-8") as stream:
        records = json.load(stream)["result"]["records"]
    locations = {int(row["סמל יישוב"]): row for row in records}
    by_name = {key(row["שם יישוב"]): row for row in records}

    rows = []
    with pdfplumber.open(booklet_path) as booklet:
        add_pdf_rows(booklet, rows, 19, "2026 deductions booklet")
    with pdfplumber.open(update_path) as update:
        for cells in update.pages[0].extract_tables()[0][1:]:
            for start in (0, 4, 8):
                try:
                    name, code = clean_name(cells[start + 2]), int(cells[start + 3])
                    cap = int(re.sub(r"\D", "", cells[start]))
                    rate = int(re.sub(r"\D", "", cells[start + 1]))
                except (IndexError, TypeError, ValueError):
                    continue
                rows.append({"name": name, "code": code, "rate": rate, "cap": cap,
                             "source": "2 August 2026 locality update", "page": 1})

    # Normalize a handful of OCR/layout variants against the official locality register.
    aliases = {
        "אדוריים": "אדורים",
        "מאוחדאשדותיעקב": "אשדותיעקבמאוחד",
        "זרעיתכפררוזנואלד": "כפררוזנואלדזרעית",
        "רמתטראמפ": "רמתהנשיאטראמפ",
        "תרביןאצאנעיישוב": "תראביןאצאנעיישוב",
    }
    for row in rows:
        row["name"] = {"אדוריים": "אדורים"}.get(key(row["name"]), row["name"].replace("\n", " "))
        if not row.get("code"):
            row["code"] = None
            locality = by_name.get(aliases.get(key(row["name"]), key(row["name"])))
            if locality:
                row["code"] = int(locality["סמל יישוב"])
        locality = locations.get(row.get("code")) if row.get("code") else by_name.get(key(row["name"]))
        if locality:
            # PDF table extraction inserts spaces inside some Hebrew words; the locality
            # register is the canonical spelling for every successfully matched code.
            row["name"] = locality["שם יישוב"]
        coordinate = locality.get("קואורדינטות") if locality else None
        if coordinate:
            packed = str(int(coordinate)).zfill(12)
            row["lat"], row["lon"] = itm_to_wgs84(int(packed[:6]), int(packed[6:]))
        else:
            row["lat"] = row["lon"] = None
        row["id"] = str(row.get("code") or key(row["name"]))

    # Eilat is a separate benefit stated in the booklet, not part of the ordinary locality table.
    eilat = locations.get(2600)
    lat, lon = None, None
    if eilat and eilat.get("קואורדינטות"):
        packed = str(int(eilat["קואורדינטות"])).zfill(12)
        lat, lon = itm_to_wgs84(int(packed[:6]), int(packed[6:]))
    rows.append({"id": "eilat", "code": 2600, "name": "אילת (הטבה נפרדת)", "rate": 10,
                 "cap": 268560, "lat": lat, "lon": lon,
                 "source": "2026 deductions booklet, Eilat section", "page": 18})

    rows.sort(key=lambda row: (key(row["name"]), row["id"]))
    with open(output_path, "w", encoding="utf-8") as stream:
        json.dump({"year": 2026, "updated": "2026-08-02", "towns": rows}, stream,
                  ensure_ascii=False, separators=(",", ":"))
        stream.write("\n")
    print(f"Wrote {len(rows)} towns; {sum(bool(row['lat']) for row in rows)} mapped.")


if __name__ == "__main__":
    main()
