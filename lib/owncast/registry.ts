export interface OwncastStreamerConfig {
  id: string;
  displayName: string;
  payoutAddress: string;
  actualSettlementAddress: string;
}

export function getOwncastStreamerConfig(): OwncastStreamerConfig {
  const actualSettlementAddress = process.env.SELLER_ADDRESS ?? "";
  const payoutAddress =
    process.env.OWNCAST_STREAMER_ADDRESS ?? actualSettlementAddress;

  return {
    id: process.env.OWNCAST_STREAMER_ID ?? "local-owncast",
    displayName: process.env.OWNCAST_STREAMER_NAME ?? "Local Owncast streamer",
    payoutAddress,
    actualSettlementAddress,
  };
}

export function describeOwncastStreamer(config: OwncastStreamerConfig): string {
  const payout =
    config.payoutAddress === config.actualSettlementAddress
      ? config.payoutAddress
      : `${config.payoutAddress} (demo config; current x402 settlement pays ${config.actualSettlementAddress})`;

  return `${config.displayName} [${config.id}] -> ${payout}`;
}
