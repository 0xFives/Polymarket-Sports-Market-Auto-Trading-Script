import type { OnChainConfig } from "polymarket-onchain";
import { config } from "./config";

/**
 * Build OnChainConfig from app config for use with polymarket-onchain.
 * Uses the project's custom logger (src/utils/logger.ts) for onchain module logging.
 */
export function getOnChainConfig(overrides?: Partial<OnChainConfig>): OnChainConfig {
  const privateKey = config.requirePrivateKey();
  return {
    privateKey,
    chainId: config.chainId ?? 137,
    rpcUrl: config.rpcUrl,
    rpcToken: config.rpcToken,
    negRisk: config.negRisk,
    ...overrides,
  };
}
