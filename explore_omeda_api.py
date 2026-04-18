import json
import os
import time
import requests

BASE_URL = "https://omeda.city"
OUTPUT_DIR = "omeda-samples"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://omeda.city/",
}

ENDPOINTS = [
    ("heroes",                    "/heroes.json"),
    ("heroes-grux",               "/heroes/Grux.json"),
    ("items",                     "/items.json"),
    ("items-ashbringer",          "/items/Ashbringer.json"),
    ("dashboard-hero-statistics", "/dashboard/hero_statistics.json"),
    ("builds",                    "/builds.json"),
]

TIMEOUT = 15
RETRIES = 2
RETRY_BACKOFF = 2
DELAY_BETWEEN = 1


def fetch(url):
    last_exc = None
    last_status = None
    for attempt in range(RETRIES + 1):
        try:
            resp = requests.get(url, headers=HEADERS, timeout=TIMEOUT)
            if resp.status_code == 200:
                return resp, None
            last_status = resp.status_code
            reason = {
                403: "Blocked (403 Forbidden)",
                429: "Rate limited (429)",
            }.get(resp.status_code, f"HTTP {resp.status_code}")
            if resp.status_code in (403, 429) or attempt == RETRIES:
                return resp, reason
        except requests.exceptions.Timeout:
            last_exc = "Timeout after 15s"
        except requests.exceptions.ConnectionError as e:
            last_exc = f"Connection error: {e}"
        except Exception as e:
            last_exc = f"Unexpected error: {e}"
        if attempt < RETRIES:
            print(f"  retrying in {RETRY_BACKOFF}s (attempt {attempt + 1}/{RETRIES})...")
            time.sleep(RETRY_BACKOFF)
    return None, last_exc or f"Failed after {RETRIES + 1} attempts (last status: {last_status})"


def extract_metrics(data):
    if isinstance(data, list):
        n_records = len(data)
        top_keys = list(data[0].keys()) if data else []
        sample = str(data[0])[:500] if data else ""
    elif isinstance(data, dict):
        n_records = None
        top_keys = list(data.keys())
        sample = str(data)[:500]
    else:
        n_records = None
        top_keys = []
        sample = str(data)[:500]
    return n_records, top_keys, sample


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    results = []

    for slug, path in ENDPOINTS:
        url = BASE_URL + path
        print(f"→ {url}")
        resp, error = fetch(url)

        if error and resp is None:
            print(f"  FAILED: {error}")
            results.append({
                "slug": slug,
                "url": url,
                "status": "ERR",
                "kb": 0,
                "n_records": "-",
                "top_keys": [],
                "sample": "",
                "error": error,
            })
            time.sleep(DELAY_BETWEEN)
            continue

        status = resp.status_code
        kb = len(resp.content) / 1024

        if error:
            print(f"  FAILED: {error}")
            results.append({
                "slug": slug,
                "url": url,
                "status": status,
                "kb": kb,
                "n_records": "-",
                "top_keys": [],
                "sample": "",
                "error": error,
            })
            time.sleep(DELAY_BETWEEN)
            continue

        try:
            data = resp.json()
        except Exception as e:
            error = f"JSON parse error: {e}"
            print(f"  FAILED: {error}")
            results.append({
                "slug": slug,
                "url": url,
                "status": status,
                "kb": kb,
                "n_records": "-",
                "top_keys": [],
                "sample": "",
                "error": error,
            })
            time.sleep(DELAY_BETWEEN)
            continue

        out_path = os.path.join(OUTPUT_DIR, f"{slug}.json")
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"  OK  {status}  {kb:.1f} KB  → {out_path}")

        n_records, top_keys, sample = extract_metrics(data)
        results.append({
            "slug": slug,
            "url": url,
            "status": status,
            "kb": kb,
            "n_records": n_records if n_records is not None else "-",
            "top_keys": top_keys,
            "sample": sample,
            "error": None,
        })
        time.sleep(DELAY_BETWEEN)

    # ── tabla resumen ────────────────────────────────────────────────────────
    print("\n" + "=" * 110)
    print("RESUMEN")
    print("=" * 110)

    col_slug    = 36
    col_status  = 8
    col_kb      = 8
    col_records = 9
    col_keys    = 40
    col_sample  = 60

    header = (
        "ENDPOINT".ljust(col_slug)
        + "STATUS".ljust(col_status)
        + "KB".ljust(col_kb)
        + "RECORDS".ljust(col_records)
        + "TOP KEYS".ljust(col_keys)
        + "SAMPLE / ERROR"
    )
    print(header)
    print("-" * 110)

    for r in results:
        keys_str = str(r["top_keys"])[:col_keys - 1]
        if r["error"]:
            detail = f"ERROR: {r['error']}"[:col_sample]
        else:
            detail = r["sample"][:col_sample]

        line = (
            r["slug"].ljust(col_slug)
            + str(r["status"]).ljust(col_status)
            + f"{r['kb']:.1f}".ljust(col_kb)
            + str(r["n_records"]).ljust(col_records)
            + keys_str.ljust(col_keys)
            + detail
        )
        print(line)

    print("=" * 110)
    ok = sum(1 for r in results if r["error"] is None)
    print(f"\n{ok}/{len(results)} endpoints OK  |  archivos en ./{OUTPUT_DIR}/\n")


if __name__ == "__main__":
    main()
