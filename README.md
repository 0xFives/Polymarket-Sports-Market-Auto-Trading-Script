# Polymarket Trading Bot

A **polymarket trading bot** for automated trading on Polymarket’s 15-minute Up/Down prediction markets. This polymarket trading bot predicts direction from the live orderbook, places the first leg at best ask, and hedges with the opposite side—so you can run a polymarket trading bot 24/7 without using the Polymarket UI.

This polymarket trading bot is built for traders and developers: TypeScript, Polymarket CLOB API, WebSocket orderbook, and a configurable adaptive price predictor. Whether you want to run a polymarket trading bot on BTC or extend the code, this repo gives you a full stack in one place.

---

## Table of Contents

- [Why This Polymarket Trading Bot?](#why-this-polymarket-trading-bot)
- [Proof of Work](#proof-of-work)
- [How This Polymarket Trading Bot Works](#how-this-polymarket-trading-bot-works)
- [Strategy Deep Dive (For Traders)](#strategy-deep-dive-for-traders)
- [Requirements](#requirements)
- [Install](#install)
- [Configuration](#configuration)
- [Configuration Reference (Full)](#configuration-reference-full)
- [Usage](#usage)
- [Architecture (For Developers)](#architecture-for-developers)
- [Project Structure](#project-structure)
- [Extending the Polymarket Trading Bot](#extending-the-polymarket-trading-bot)
- [Risk & Disclaimer](#risk--disclaimer)
- [License](#license)

---

## Why This Polymarket Trading Bot?

- **Capture every 15m window** — This polymarket trading bot resolves market slugs, connects to the orderbook, and trades on schedule. No missed rounds.
- **Predict then hedge** — The polymarket trading bot uses an adaptive price predictor (momentum, volatility, trend) to choose Up or Down from orderbook flow; it buys the predicted side at best ask (GTC), then places the hedge at `0.98 − firstSidePrice` (GTC).
- **One config, many markets** — Set `COPYTRADE_MARKETS=btc` or `btc,eth,sol`; the polymarket trading bot resolves slugs as `{market}-updown-15m-{startOf15mUnix}` via Polymarket’s Gamma API.
- **Full stack** — CLOB client, USDC/CTF allowances, and redemption scripts. Run the polymarket trading bot, then redeem resolved positions with one command.

If you are looking for an open-source polymarket trading bot for 15m Up/Down markets, this is it.

---

## Proof of Work

https://github.com/user-attachments/assets/1327bdc8-4b8e-4e5f-a184-aef0d51ac3ec

---

## How This Polymarket Trading Bot Works

High-level flow of the polymarket trading bot:

1. **Bootstrap** — Load config from `.env`, create or load CLOB API credentials (`src/data/credential.json`), approve USDC and CTF allowances on Polygon, and wait until wallet USDC meets `BOT_MIN_USDC_BALANCE`.
2. **Market resolution** — For each market (e.g. `btc`), the polymarket trading bot computes the current 15m slug (e.g. `btc-updown-15m-1734567890`) and fetches Up/Down token IDs and `conditionId` from Gamma API.
3. **Orderbook** — The polymarket trading bot subscribes to Polymarket’s CLOB WebSocket for those token IDs and receives real-time best bid/ask updates.
4. **Prediction** — On each price update, an **AdaptivePricePredictor** (per market) consumes smoothed price history and outputs: direction (Up/Down), confidence, and signal (BUY_UP / BUY_DOWN / HOLD). The predictor uses momentum, volatility, trend, and optional pole (peak/trough) logic; it adapts weights with online gradient descent.
5. **Execution** — When the polymarket trading bot gets BUY_UP or BUY_DOWN, it places a limit order on the predicted side at best ask (with optional `COPYTRADE_PRICE_BUFFER`), then places the hedge on the opposite side at `0.98 − firstSidePrice`. Orders are GTC; `COPYTRADE_FIRE_AND_FORGET` controls whether the bot waits for order confirmation.
6. **State** — Per-slug state (e.g. last prices, buy counts, conditionId) is stored in `src/data/copytrade-state.json`. The polymarket trading bot rolls to the next 15m slug at quarter-hour boundaries and re-initializes markets as needed.
7. **Redemption** — After markets resolve, use the included scripts to redeem winnings (by holdings file or by condition ID). The polymarket trading bot does not auto-redeem; you run redemption separately.

---

## Strategy Deep Dive (For Traders)

### Markets

This polymarket trading bot targets **15-minute Up/Down** binary markets on Polymarket (e.g. “Will BTC be higher or lower in 15 minutes?”). Each market has:

- **Slug** — `{market}-updown-15m-{startOf15mUnix}` (e.g. `btc-updown-15m-1734567890`). The polymarket trading bot computes the slug from the current time and fetches token IDs from Gamma.
- **Up (YES) and Down (NO) tokens** — Complementary outcomes; prices typically sum near 1 (minus spread/fees). The polymarket trading bot trades both sides to implement a predict-then-hedge strategy.

### Order Flow

1. **Signal** — The polymarket trading bot’s predictor outputs BUY_UP or BUY_DOWN (or HOLD). HOLD means no order is placed.
2. **First leg** — Limit buy on the predicted side at **best ask** (optionally plus `COPYTRADE_PRICE_BUFFER` for faster fill). Size is `COPYTRADE_SHARES` per side.
3. **Second leg (hedge)** — Limit buy on the opposite side at **0.98 − firstSidePrice**. If the first side is filled at e.g. 0.52, the hedge is at 0.46. This targets a combined cost below 0.98 so that if one side wins, the position can be profitable after redemption.
4. **Caps** — `COPYTRADE_MAX_BUY_COUNTS_PER_SIDE` (if &gt; 0) limits how many times per market cycle the polymarket trading bot can buy each side; after the cap, that market is paused until the next 15m cycle.

### Predictor (AdaptivePricePredictor)

The polymarket trading bot uses a multi-feature adaptive predictor:

- **Inputs** — Smoothed price history (EMA), momentum, volatility, trend (short/long EMA and price-change history). Optional pole detection (peaks/troughs) can gate or weight predictions.
- **Outputs** — `direction` (up/down), `confidence` (0–1), `signal` (BUY_UP / BUY_DOWN / HOLD). Prices outside 0.003–0.97 are ignored to avoid extreme quotes.
- **Learning** — Online gradient descent updates weights (e.g. momentum, volatility, trend) over time; recent accuracy is tracked in a sliding window so the polymarket trading bot can adapt to market regime.

Understanding the predictor helps you tune risk and interpret logs when running this polymarket trading bot.

### Risk and Position Sizing

- **Balance** — The polymarket trading bot checks `BOT_MIN_USDC_BALANCE` before starting and uses `COPYTRADE_MIN_BALANCE_USDC` for runtime. Ensure your wallet has enough USDC for intended size and number of rounds.
- **Exposure** — You are taking prediction-market risk on each 15m outcome. The hedge reduces but does not eliminate variance; both legs can fill at worse prices than expected.
- **Redemption** — Resolved positions must be redeemed on-chain. Use the provided redemption scripts; the polymarket trading bot does not redeem automatically.

---

## Requirements

- **Node.js 18+** (or Bun)
- **Polygon wallet** with USDC (for the polymarket trading bot to place orders and pay fees)
- **RPC URL** for Polygon (e.g. Alchemy) for allowances and redemption

---

## Install

```bash
git clone https://github.com/0xFives/Polymarket-Arbitrage-Crypto-Trading-Bot-V3.git
cd Polymarket-Arbitrage-Crypto-Trading-Bot-V3
npm install
```

---

## Configuration

Copy the example env and set at least `PRIVATE_KEY` and `COPYTRADE_MARKETS`:

```bash
cp .env.temp .env
```

Minimum for running the polymarket trading bot:

- `PRIVATE_KEY` — Wallet private key (required).
- `COPYTRADE_MARKETS` — Comma-separated list (e.g. `btc` or `btc,eth,sol`).

Optional: set `RPC_URL` (and `RPC_TOKEN` if needed) for allowances and redemption. API credentials are created on first run and stored in `src/data/credential.json`.

---

## Configuration Reference (Full)

| Variable | Description | Default |
|----------|-------------|---------|
| `PRIVATE_KEY` | Wallet private key | **required** |
| `COPYTRADE_MARKETS` | Comma-separated markets (e.g. `btc`) | `btc` |
| `COPYTRADE_SHARES` | Shares per side per trade | `5` |
| `COPYTRADE_TICK_SIZE` | Price precision | `0.01` |
| `COPYTRADE_PRICE_BUFFER` | Price buffer for execution (e.g. 0.01 = 1¢) | `0` |
| `COPYTRADE_WAIT_FOR_NEXT_MARKET_START` | Wait for next 15m boundary before starting | `false` |
| `COPYTRADE_MAX_BUY_COUNTS_PER_SIDE` | Max buys per side per market (0 = no cap) | `0` |
| `COPYTRADE_FIRE_AND_FORGET` | Don’t wait for order confirmation | `true` |
| `COPYTRADE_NEG_RISK` | Use neg-risk order type | `false` |
| `COPYTRADE_MIN_BALANCE_USDC` | Min USDC to keep trading | `1` |
| `CHAIN_ID` | Chain ID (Polygon) | `137` |
| `CLOB_API_URL` | CLOB API base URL | `https://clob.polymarket.com` |
| `RPC_URL` / `RPC_TOKEN` | RPC for allowances/redemption | — |
| `BOT_MIN_USDC_BALANCE` | Min USDC to start polymarket trading bot | `1` |
| `USE_PROXY_WALLET` | Use Polymarket proxy wallet | `false` |
| `PROXY_WALLET_ADDRESS` | Proxy wallet address (if above true) | — |
| `LOG_DIR` / `LOG_FILE_PREFIX` | Log directory and file prefix | `logs` / `bot` |
| `LOG_FILE_PATH` | Override log file path (supports `{date}`) | — |
| `DEBUG` | Verbose logs | `false` |

---

## Usage

### Run the polymarket trading bot

```bash
npm start
# or: bun src/index.ts
```

### Redemption

After markets resolve, redeem winnings:

```bash
# Auto-redeem from holdings file (generated by polymarket trading bot activity)
npm run redeem:holdings
# or: bun src/redeem-holdings.ts [--dry-run] [--clear-holdings] [--api] [--max N]

# Redeem by condition ID
npm run redeem
# or: bun src/redeem.ts [conditionId] [indexSets...]
bun src/redeem.ts --check <conditionId>
```

### Development

```bash
npx tsc --noEmit
bun --watch src/index.ts
```

---

## Architecture (For Developers)

### Entry and Bootstrap

- **`src/index.ts`** — Validates `PRIVATE_KEY`, creates/loads CLOB credentials, approves USDC/CTF allowances, waits for `BOT_MIN_USDC_BALANCE`, optionally waits for the next 15m boundary, then instantiates `CopytradeArbBot` and starts it. Handles SIGINT/SIGTERM and triggers summary generation before exit.

### Config

- **`src/config/index.ts`** — Loads `.env` and exposes typed config: chain, CLOB URL, copytrade (markets, shares, tick size, buffers, caps), logging, redeem args. Used everywhere the polymarket trading bot needs settings.

### Core Bot and Order Flow

- **`src/order-builder/copytrade.ts`** — **CopytradeArbBot**: holds CLOB client and config; computes 15m slugs; fetches token IDs and conditionId from Gamma; subscribes to WebSocket orderbook per token; maintains per-market `AdaptivePricePredictor` and per-slug state; on price updates runs predictor and, on BUY_UP/BUY_DOWN, places first-side then hedge orders. Persists state to `src/data/copytrade-state.json` and tracks prediction/trade stats for summaries.

### Data and APIs

- **`src/providers/clobclient.ts`** — Singleton CLOB client (credentials + `PRIVATE_KEY`); used for order placement and balance/allowance sync.
- **`src/providers/websocketOrderbook.ts`** — WebSocket client for Polymarket CLOB “market” channel; subscribes by token ID; exposes best bid/ask and price-update callbacks used by the polymarket trading bot for real-time signals.

### Prediction and Utilities

- **`src/utils/pricePredictor.ts`** — **AdaptivePricePredictor**: price history (smoothed), momentum, volatility, trend, optional pole detection; outputs direction, confidence, signal; online learning. Used once per market by the polymarket trading bot.
- **`src/utils/redeem.ts`** — CTF redemption helpers, resolution checks, auto-redeem from holdings or API (used by redeem scripts).
- **`src/utils/holdings.ts`** — Writes/reads token holdings for redemption (e.g. `src/data/token-holding.json`).

### Security and On-Chain

- **`src/security/allowance.ts`** — USDC and CTF approvals. Called at startup so the polymarket trading bot can trade.
- **`src/security/createCredential.ts`** / **`src/security/validatePrivateKey.ts`** — CLOB API credential creation and key validation.

### Data Files (generated at runtime)

- **`src/data/credential.json`** — CLOB API credentials (created on first run).
- **`src/data/copytrade-state.json`** — Per-slug state (prices, timestamps, conditionId, buy counts).
- **`src/data/token-holding.json`** — Token holdings for redemption.

---

## Project Structure

| Path | Role |
|------|------|
| `src/index.ts` | Entry: credentials, CLOB, allowances, min balance, start polymarket trading bot (`CopytradeArbBot`). |
| `src/config/index.ts` | Loads `.env`; exposes config for the polymarket trading bot. |
| `src/order-builder/copytrade.ts` | **CopytradeArbBot**: 15m slugs, WebSocket, predictor → first-side + hedge; state. |
| `src/order-builder/helpers.ts` | Order-building helpers (prices, sizes, options). |
| `src/order-builder/types.ts` | Shared types for orders and bot. |
| `src/providers/clobclient.ts` | CLOB client singleton. |
| `src/providers/websocketOrderbook.ts` | WebSocket orderbook; best bid/ask by token ID. |
| `src/utils/pricePredictor.ts` | **AdaptivePricePredictor**: direction, confidence, signal. |
| `src/utils/redeem.ts` | CTF redemption and resolution checks. |
| `src/utils/holdings.ts` | Token holdings for redemption. |
| `src/utils/logger.ts` | Logging used by the polymarket trading bot. |
| `src/utils/balance.ts` | Min USDC balance wait logic. |
| `src/security/allowance.ts` | USDC/CTF approvals. |
| `src/security/createCredential.ts` | CLOB credential creation. |
| `src/security/validatePrivateKey.ts` | Private key validation. |
| `src/data/*.json` | Credentials, state, holdings (generated). |

---

## Extending the Polymarket Trading Bot

- **New markets** — Add symbols to `COPYTRADE_MARKETS`. The polymarket trading bot only supports 15m Up/Down slugs resolved via Gamma; other market types would require slug resolution and possibly different predictor logic.
- **Predictor** — Replace or wrap `AdaptivePricePredictor` in `src/utils/pricePredictor.ts`, or add features/weights. The polymarket trading bot expects `direction`, `confidence`, and `signal` (BUY_UP / BUY_DOWN / HOLD).
- **Order logic** — First-side and hedge prices/sizes are in `src/order-builder/copytrade.ts`. Change formulas (e.g. hedge at something other than `0.98 − firstSidePrice`) or add filters (e.g. min confidence) there.
- **Redemption** — Use or adapt `src/utils/redeem.ts` and the redeem scripts; the polymarket trading bot does not call redemption itself.

---

## Risk & Disclaimer

Trading prediction markets involves significant risk. This polymarket trading bot and its documentation are provided as-is. Use at your own discretion and only with funds you can afford to lose. Past behavior of the polymarket trading bot does not guarantee future results.

---

## Contact

[oxlabs-five](https://t.me/oxylabs_five)
