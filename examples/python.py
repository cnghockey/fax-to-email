"""
fax-to-email — Python example.

Requires:
    pip install requests

Usage:
    python python.py --email alice@example.com --from-number +14155550123
    python python.py --email alice@example.com --from-number +14155550123 --ocr
"""

from __future__ import annotations

import argparse
import re
import sys

import requests

ENDPOINT = "https://sats4ai.com/api/l402/receive-fax"


def parse_challenge(www_authenticate: str) -> tuple[str, str]:
    mac = re.search(r'macaroon="([^"]+)"', www_authenticate)
    inv = re.search(r'invoice="([^"]+)"', www_authenticate)
    if not (mac and inv):
        raise RuntimeError(f"Could not parse L402 challenge: {www_authenticate!r}")
    return mac.group(1), inv.group(1)


def subscribe(body: dict) -> None:
    # Step 1 — request invoice
    r = requests.post(ENDPOINT, json=body)
    if r.status_code != 402:
        sys.exit(f"Expected 402, got {r.status_code}: {r.text}")
    macaroon, invoice = parse_challenge(r.headers["WWW-Authenticate"])

    # Step 2 — pay out-of-band
    print("\nPay this invoice with your Lightning wallet:\n")
    print(invoice + "\n")
    preimage = input("preimage (hex): ").strip()

    # Step 3 — open subscription
    r = requests.post(
        ENDPOINT,
        json=body,
        headers={"Authorization": f"L402 {macaroon}:{preimage}"},
    )
    result = r.json()
    print("\nResponse:", result)

    if result.get("status") == "subscribed":
        print(
            f"\n✓ Subscription active."
            f"\n  Ask your sender to fax from {body['from_number']} to {result['forward_to_number']}"
            f"\n  Window expires at {result['expires_at']}"
            f"\n  PDF will be delivered to {body['email']}"
        )


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--email", required=True, help="Where to deliver the PDF")
    p.add_argument("--from-number", required=True, help="Expected sender fax in E.164")
    p.add_argument("--ocr", action="store_true", help="Attach OCR text file (+200 sats)")
    args = p.parse_args()

    subscribe({
        "email": args.email,
        "from_number": args.from_number,
        "ocr": args.ocr,
    })


if __name__ == "__main__":
    main()
