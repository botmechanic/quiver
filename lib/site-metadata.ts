/**
 * Copyright 2026 Circle Internet Group, Inc.  All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/** Canonical site URL for metadata and OG (prefer BASE_URL in production). */
export function getSiteUrl(): URL {
  if (process.env.BASE_URL) {
    return new URL(process.env.BASE_URL);
  }
  if (process.env.VERCEL_URL) {
    return new URL(`https://${process.env.VERCEL_URL}`);
  }
  return new URL("http://localhost:3000");
}

export const siteName = "Quiver";

export const siteDescription =
  "A per-second x402 settlement rail on Arc. Quiver meters exact seconds with per-tick EIP-3009 auths, using Archer and Scout as the agent demo and an Owncast sidecar as the creator deployment surface.";

export const siteKeywords = [
  "Quiver",
  "x402",
  "Arc",
  "Circle Gateway",
  "nanopayments",
  "USDC",
  "streaming payments",
  "creator payments",
  "Owncast",
  "AI agents",
  "EIP-3009",
  "Lepton Agents Hackathon",
];
