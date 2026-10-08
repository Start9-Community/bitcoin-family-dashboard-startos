# Bitcoin Family Dashboard

## Documentation

- [Bitcoin Family Dashboard README](https://github.com/wahidsaleemi/bitcoin-family-dashboard/blob/main/README.md) — the upstream project's documentation.

## What you get on StartOS

A **Web UI** interface serving the dashboard: every family member with their bitcoin, its value at the live price, and profit or loss against their average purchase price, plus rotating 30-day, 1-year and 10-year price charts. The dashboard is configured from the StartOS **Actions** menu rather than by editing a file, and it can read a member's balance straight from a watch-only wallet — through Bitcoin on this server if you have it installed, or through public block explorers if you don't.

## Getting set up

The service starts with a sample member, "Satoshi", so the page has something to show. Replace it with your own family:

1. Open **Manage Family Members** in the Actions menu.
2. Remove "Satoshi" and add a member for each person, with their **Average Cost Basis** (the average price they paid per BTC, in USD).
3. Under **Holdings**, pick **Entered manually** and type the amount, or pick **Watch-only wallet** and paste the wallet's output descriptor (for example `wpkh(xpub.../0/*)`) — see below.
4. Save, then open the **Web UI** from the Dashboard tab.

## Using Bitcoin Family Dashboard

### Watch-only wallets

Pasting a wallet's output descriptor lets the dashboard show that member's real on-chain balance instead of a typed amount. Only public keys are involved — never paste a seed phrase or private key. Descriptors of the form `wpkh(...)`, `pkh(...)`, `sh(wpkh(...))`, `tr(...)`, `wsh(sortedmulti(...))`, or a bare `xpub` are accepted; the key must be an `xpub` (a `zpub` or `ypub` will be rejected).

**Balance Source** decides where the balance comes from:

- **Bitcoin on this server** uses your own node. The first time a wallet is added, Bitcoin scans the whole chain for it, which can take an hour or more; after that the balance is instant and private. Bitcoin must be running and fully synced, unpruned, and with its wallet enabled; StartOS prompts you on Bitcoin's page if either setting needs changing.
- **Public address APIs** asks mempool.space and other public block explorers. They limit how often you can ask, so a first balance can take a while — possibly hours — and the dashboard shows "Fetching…" until it arrives.

A wallet set to **Bitcoin on this server** never asks a public explorer, so if Bitcoin is stopped, pruned or has its wallet off, its balance stays on "Fetching…" until you fix that or switch the source. The **Watch-Only Wallets** health check reports what is being scanned until every wallet has a balance.

### Custom avatars

Hover over a member's avatar on the dashboard and click it to upload a picture. Avatars are stored in your browser, so each device keeps its own.

### Actions

- **Manage Family Members** — add, remove and edit members, their holdings and their watch-only wallets.
- **Configure Dashboard** — set the dashboard title, choose the price source (Coinbase Exchange, Binance, Bitstamp, or your own API), and turn rotating background photos on with a free [Pexels API key](https://www.pexels.com/api/). Changing the price source restarts the service. When background photos are shown, a small credit appears in the bottom-right corner linking Pexels and the photographer, as the Pexels API guidelines ask.

## Limitations

- The dashboard has no login. Anyone who can open its address can see every member's holdings, so keep it on your LAN or behind Tor rather than a public domain.
- Adding a watch-only wallet with Bitcoin as the source creates a small watch-only wallet inside Bitcoin, named after the member. It stays there if you later uninstall the dashboard.
