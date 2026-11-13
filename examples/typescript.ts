/**
 * fax-to-email — TypeScript example (Node 18+).
 *
 * No dependencies — uses built-in fetch and readline.
 *
 * Usage:
 *   npx tsx typescript.ts --email alice@example.com --from-number +14155550123
 *   npx tsx typescript.ts --email alice@example.com --from-number +14155550123 --ocr
 */

import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const ENDPOINT = "https://sats4ai.com/api/l402/receive-fax";

interface SubscribeBody {
    email: string;
    from_number: string;
    ocr?: boolean;
}

function parseChallenge(header: string): { macaroon: string; invoice: string } {
    const mac = header.match(/macaroon="([^"]+)"/);
    const inv = header.match(/invoice="([^"]+)"/);
    if (!mac || !inv) throw new Error(`Could not parse L402 challenge: ${header}`);
    return { macaroon: mac[1], invoice: inv[1] };
}

async function subscribe(body: SubscribeBody): Promise<void> {
    // Step 1 — request invoice
    const r1 = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
    if (r1.status !== 402) {
        throw new Error(`Expected 402, got ${r1.status}: ${await r1.text()}`);
    }
    const { macaroon, invoice } = parseChallenge(r1.headers.get("www-authenticate") ?? "");

    // Step 2 — pay out-of-band
    console.log("\nPay this invoice with your Lightning wallet:\n");
    console.log(invoice + "\n");
    const rl = readline.createInterface({ input, output });
    const preimage = (await rl.question("preimage (hex): ")).trim();
    rl.close();

    // Step 3 — open subscription
    const r2 = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `L402 ${macaroon}:${preimage}`,
        },
        body: JSON.stringify(body),
    });
    const result = await r2.json();
    console.log("\nResponse:", result);

    if (result.status === "subscribed") {
        console.log(
            `\n✓ Subscription active.` +
            `\n  Ask your sender to fax from ${body.from_number} to ${result.forward_to_number}` +
            `\n  Window expires at ${result.expires_at}` +
            `\n  PDF will be delivered to ${body.email}`
        );
    }
}

function parseArgs(): SubscribeBody {
    const argv = process.argv.slice(2);
    const get = (flag: string): string | undefined => {
        const i = argv.indexOf(flag);
        return i >= 0 ? argv[i + 1] : undefined;
    };
    const email = get("--email");
    const fromNumber = get("--from-number");
    if (!email || !fromNumber) {
        console.error("Usage: --email alice@example.com --from-number +14155550123 [--ocr]");
        process.exit(1);
    }
    return {
        email,
        from_number: fromNumber,
        ocr: argv.includes("--ocr"),
    };
}

subscribe(parseArgs()).catch((err) => {
    console.error(err);
    process.exit(1);
});
