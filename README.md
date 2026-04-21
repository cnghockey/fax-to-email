# fax-to-email

**Receive a fax to your inbox. Pay once, per incoming fax. No monthly number rental, no subscription.**

> Alternative to eFax, MyFax, SRFax, FaxBurner — without renting a dedicated fax number by the month. MCP-native for agent frameworks.

A compound **fax-to-email API** that bundles an inbound fax subscription window, delivery to your email, and optional OCR text extraction into one HTTP endpoint. Useful when you're expecting a fax back from a bank, court, hospital, or government office — and you don't want to rent a dedicated fax number and monthly plan just for this one document. Built on Sats4AI's L402 payment protocol.

Search terms: *fax to email api, receive fax online, receive fax api, online fax number, virtual fax number, efax alternative api, myfax alternative, faxburner alternative, pay per fax received, inbound fax api, mcp fax tool, l402 fax*.

---

## What makes it different

- **Pay per incoming fax, not per month.** 500 sats opens a 24-hour window at the shared receive number. 700 sats if you want OCR text extraction attached to the delivery email.
- **No dedicated number rental.** Every other receive-fax service sells you a number subscription. Here you share a number (`+1 320 299 1523`) and the subscription is matched by the *sender's* caller ID.
- **First matching sender wins.** Matched on the last 10 digits of caller ID. Subsequent faxes from the same origin during the window are silently dropped. Prevents collision on a shared number.
- **OCR optional.** Add `ocr: true` for +200 sats — the email delivery includes a searchable text file alongside the PDF. Useful for feeding a fax into an agent pipeline. If OCR fails, an LNURL-withdraw for the 200-sat OCR fee is attached to the delivery email.
- **Failure-aware window extension.** Upstream failure events automatically extend the receive window (up to 2 extensions of 8 hours each) so short outages don't cost you the subscription.
- **MCP-native.** Agents subscribe to receive windows programmatically — payment is negotiated inside the protocol.

---

## Quickstart

### Via MCP (agent-native — payment handled inline)

```
{
  "mcpServers": {
    "sats4ai": {
      "command": "npx",
      "args": ["-y", "sats4ai-mcp"]
    }
  }
}
```

Your agent discovers the `receive-fax` tool and invokes it directly.

### Via HTTP

```bash
# Step 1: POST without auth → receive 402 + Lightning invoice
curl -i -X POST https://sats4ai.com/api/l402/receive-fax \
  -H "Content-Type: application/json" \
  -d '{
    "email": "alice@example.com",
    "from_number": "+14155552671",
    "ocr": false
  }'

# Response:
#   HTTP/1.1 402 Payment Required
#   WWW-Authenticate: L402 macaroon="<b64>", invoice="lnbc..."

# Step 2: Pay the invoice with any Lightning wallet → you get a preimage

# Step 3: Retry with Authorization header to open the receive window
curl -X POST https://sats4ai.com/api/l402/receive-fax \
  -H "Authorization: L402 <macaroon>:<preimage>" \
  -H "Content-Type: application/json" \
  -d '{ ...same body... }'

# Response:
#   { "status": "subscribed", "subscription_id": "...", "from_number": "+14155552671",
#     "email": "alice@example.com", "ocr": false, "expires_at": "2026-04-22T18:00:00Z",
#     "forward_to_number": "+13202991523" }

# Step 4: Ask your sender to dial +13202991523 from +14155552671.
#         When the fax arrives, it lands in alice@example.com.
```

See [examples/](examples/) for runnable scripts in curl, Python, and TypeScript.

---

## How it works

```
┌──────────┐   1. POST email + sender caller ID   ┌─────────────┐
│  Client  │ ──────────────────────────────────>  │   Sats4AI   │
│          │                                      │ receive-fax │
│          │ <────── 402 + invoice ──────────     │  endpoint   │
└──────────┘                                      └─────────────┘
      │
      │ 2. Pay via Lightning wallet
      │
      ▼
┌──────────┐   3. POST + L402 auth                 Open 24h window
│  Client  │ ──────────────────────────────────>   matched by
│          │ <── { subscription_id, receive #} ──  caller-ID digits
└──────────┘
      │
      │ 4. Sender dials receive number from their fax
      │
      ▼
   Incoming fax ─── Match caller ID ─── Deliver PDF to email
                        │
                        └─ OCR? ── Attach .txt or LNURL-withdraw on failure
```

---

## Pricing

| Tier | Cost | Includes |
|---|---|---|
| Base | 500 sats | PDF delivered to email, 24-hour window |
| With OCR | 700 sats | PDF + searchable text file; LNURL-withdraw refund of +200 sats if OCR fails |
| Overage | +50 sats/page beyond 10 (+20 sats/page for OCR) | Billed separately, PDF held 7 days pending overage payment |

**Non-refundable.** The window itself is paid whether or not a fax arrives — this is what prevents subscription squatting on a shared number.

---

## Compare

| | fax-to-email (Sats4AI) | Typical receive-fax service |
|---|---|---|
| Number rental | None — shared number, matched by sender caller ID | Monthly dedicated number rental |
| Pricing | Per incoming fax (500 sats base) | Monthly subscription regardless of usage |
| Signup | None | Email + credit card |
| Credential | Lightning preimage | Account login |
| OCR add-on | +200 sats, refunded on failure | Often paid extra and non-refundable |
| MCP-native | Yes | No (build your own agent integration) |

---

## Real use cases

- **Expecting a bank confirmation fax.** Open a 24-hour window, give the bank the shared number, get the PDF in email when it arrives.
- **Court filings / legal responses.** Short, time-bounded need — no reason to rent a number year-round.
- **Medical results.** Hospitals often fax — receive to your email with OCR so an agent can parse the result.
- **Agent-driven paper workflows.** Autonomous agents expecting signed paperwork back — the agent subscribes, polls for delivery, and processes the OCR text automatically.

---

## Request reference

| Field | Required | Example |
|---|---|---|
| `email` | yes | `"alice@example.com"` |
| `from_number` | yes | `"+14155552671"` (expected sender caller ID, last 10 digits matched) |
| `ocr` | no | `true` — attach searchable text file (+200 sats) |

Full JSON Schema: [sats4ai.com/api/openapi.json](https://sats4ai.com/api/openapi.json) (tag: `receive-fax`).

---

## Receive number

Ask the sender to fax to **+1 320 299 1523** — this is the shared receive number for every subscription. The system matches their caller ID against your `from_number` and routes the PDF to your email.

---

## Related

- [`pay-per-use-fax`](https://github.com/cnghockey/pay-per-use-fax) — Send a fax with Lightning (outbound pair).
- [`ai-caller`](https://github.com/cnghockey/ai-caller) — AI voice agent API, pay per call with Lightning.
- [`book-to-audiobook`](https://github.com/cnghockey/book-to-audiobook) — Turn any book into an audiobook in 600+ languages.
- [`sats4ai-mcp`](https://github.com/cnghockey/sats4ai-mcp-server) — MCP server bundling all 35+ Sats4AI services.
- [`sats4ai-l402-examples`](https://github.com/cnghockey/sats4ai-l402-examples) — Full L402 examples across every service.

## Links

- **Sats4AI homepage** — https://sats4ai.com
- **Developer docs** — https://sats4ai.com/docs
- **OpenAPI spec** — https://sats4ai.com/api/openapi.json

## License

MIT — see [LICENSE](LICENSE).

<details>
<summary>Repository setup (for maintainers)</summary>

```bash
gh repo create cnghockey/fax-to-email --public --source=. \
  --description "Fax-to-email API — open a 24h receive window, get faxes delivered to your inbox with optional OCR. Pay with Bitcoin Lightning, no subscription. MCP-native. Alternative to eFax, MyFax, SRFax, FaxBurner." \
  --homepage "https://sats4ai.com" \
  --push

gh repo edit cnghockey/fax-to-email \
  --add-topic fax \
  --add-topic fax-to-email \
  --add-topic receive-fax \
  --add-topic online-fax-number \
  --add-topic virtual-fax-number \
  --add-topic inbound-fax \
  --add-topic fax-api \
  --add-topic ocr \
  --add-topic pay-per-use \
  --add-topic no-signup \
  --add-topic mcp \
  --add-topic model-context-protocol \
  --add-topic l402 \
  --add-topic lightning-network \
  --add-topic bitcoin \
  --add-topic email \
  --add-topic efax-alternative \
  --add-topic myfax-alternative \
  --add-topic faxburner-alternative
```

</details>
