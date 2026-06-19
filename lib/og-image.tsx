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

import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const ogImageSize = { width: 1200, height: 630 } as const;

export const ogImageAlt =
  "Quiver — pay-per-second streaming nanopayments over x402 on Arc";

export async function generateOgImage() {
  const svg = await readFile(
    path.join(process.cwd(), "public/quiver-logo.svg"),
    "utf8",
  );
  const logoSrc = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          background: "#0B0B0D",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "48px 64px",
        }}
      >
        <img
          src={logoSrc}
          alt=""
          width={880}
          height={464}
          style={{ objectFit: "contain" }}
        />
      </div>
    ),
    { ...ogImageSize },
  );
}
