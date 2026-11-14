#!/usr/bin/env python3
"""
check_prices.py — are the Business prices in this app the same as on biz.aiwithrobert.com?

Reads every Business `rate:` in src/lib/services.js (BUSINESS_SERVICES) and confirms each
amount appears in the Business site's llms.txt (the plain-text copy of its Pricing section).
Run:  python3 scripts/check_prices.py           (fetches https://biz.aiwithrobert.com/llms.txt)
      python3 scripts/check_prices.py FILE      (or compare with a local copy)
Prints OK or the exact mismatch; exit code 1 on mismatch. The weekly "Checks" workflow runs it,
so a price changed on the site but not here shows up as a red run (GitHub emails you).
Note: it cannot see the toolkit's FX_PRICE (private repo); change that one by hand with the others.
"""
import re
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
src = (ROOT / "src/lib/services.js").read_text(encoding="utf-8")
biz = src.split("export const BUSINESS_SERVICES", 1)[1]
rates = sorted({float(x) for x in re.findall(r"rate:\s*([\d.]+)", biz)})

if len(sys.argv) > 1:
    text = Path(sys.argv[1]).read_text(encoding="utf-8")
else:
    text = urllib.request.urlopen("https://biz.aiwithrobert.com/llms.txt", timeout=30).read().decode("utf-8")

missing = []
for r in rates:
    n = int(r)
    forms = {f"${n:,}", f"${n}"}
    if not any(f in text for f in forms):
        missing.append(f"${n:,}")
if missing:
    print("MISMATCH: these Business rates in src/lib/services.js are not in the website's pricing text: " + ", ".join(missing))
    print("Change the price in the app (src/lib/services.js) or on the site (+ toolkit FX_PRICE) so all three agree.")
    sys.exit(1)
print(f"OK: all {len(rates)} Business rates in the app appear on biz.aiwithrobert.com")
