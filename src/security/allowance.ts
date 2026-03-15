import { AssetType, ClobClient } from "@polymarket/clob-client";
import {
  approveUSDCAllowance as approveUSDCAllowanceOnChain,
  updateClobBalanceAllowance as updateClobBalanceAllowanceOnChain,
  approveTokensAfterBuy as approveTokensAfterBuyOnChain,
} from "polymarket-onchain";
import { getOnChainConfig } from "../onchain-config";

/**
 * Approve USDC and CTF to Polymarket contracts (Exchange, ConditionalTokens; optional NegRisk).
 * Delegates to polymarket-onchain with app config.
 */
export async function approveUSDCAllowance(): Promise<void> {
  await approveUSDCAllowanceOnChain(getOnChainConfig());
}

/**
 * Sync on-chain balance allowance with the CLOB API after setting allowances.
 */
export async function updateClobBalanceAllowance(client: ClobClient): Promise<void> {
  await updateClobBalanceAllowanceOnChain(client);
}

/**
 * Approve ConditionalTokens for Exchange (and NegRisk if enabled) after buying tokens.
 */
export async function approveTokensAfterBuy(): Promise<void> {
  await approveTokensAfterBuyOnChain(getOnChainConfig());
}
