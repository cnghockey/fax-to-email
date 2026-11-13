#!/usr/bin/env bash
#
# fax-to-email — bash / curl example
#
# Requires:
#   - curl, jq
#   - any Lightning wallet that can pay a bolt11 and return a preimage
#
# Usage:
#   EMAIL="alice@example.com" FROM_NUMBER="+14155550123" ./curl.sh
#   EMAIL="alice@example.com" FROM_NUMBER="+14155550123" OCR=true ./curl.sh

set -euo pipefail

ENDPOINT="${ENDPOINT:-https://sats4ai.com/api/l402/receive-fax}"
EMAIL="${EMAIL:?set EMAIL to the address where the PDF should be delivered}"
FROM_NUMBER="${FROM_NUMBER:?set FROM_NUMBER to the expected sender fax in E.164}"
OCR="${OCR:-false}"

BODY=$(jq -n \
  --arg email "$EMAIL" \
  --arg from_number "$FROM_NUMBER" \
  --argjson ocr "$OCR" \
  '{email:$email, from_number:$from_number, ocr:$ocr}')

echo "→ Step 1: requesting invoice"
HEADERS=$(curl -si -X POST "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -d "$BODY" | tr -d '\r')

WWW_AUTH=$(echo "$HEADERS" | awk 'tolower($1)=="www-authenticate:" {sub(/^[^:]+:[ ]*/,""); print; exit}')
MACAROON=$(echo "$WWW_AUTH" | sed -n 's/.*macaroon="\([^"]*\)".*/\1/p')
INVOICE=$(echo "$WWW_AUTH"  | sed -n 's/.*invoice="\([^"]*\)".*/\1/p')

if [[ -z "$MACAROON" || -z "$INVOICE" ]]; then
  echo "  ✗ Did not receive a 402 challenge. Response headers:" >&2
  echo "$HEADERS" >&2
  exit 1
fi

echo "  ✓ Got invoice"
echo ""
echo "→ Step 2: pay this invoice with your Lightning wallet, then paste the preimage"
echo ""
echo "$INVOICE"
echo ""
read -rp "preimage (hex): " PREIMAGE

echo "→ Step 3: opening receive window"
RESPONSE=$(curl -s -X POST "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -H "Authorization: L402 ${MACAROON}:${PREIMAGE}" \
  -d "$BODY")

echo "$RESPONSE" | jq .

STATUS=$(echo "$RESPONSE" | jq -r '.status // empty')
if [[ "$STATUS" == "subscribed" ]]; then
  FORWARD=$(echo "$RESPONSE" | jq -r '.forward_to_number')
  EXPIRES=$(echo "$RESPONSE" | jq -r '.expires_at')
  echo ""
  echo "✓ Subscription active."
  echo "  Ask your sender to fax from $FROM_NUMBER to $FORWARD"
  echo "  Window expires at $EXPIRES"
  echo "  PDF will be delivered to $EMAIL"
fi
