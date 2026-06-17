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

"use client";

import { useState } from "react";
import { login } from "./actions";
import { TryQuiverPanel } from "@/components/try-quiver-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Home() {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    const result = await login(formData);
    if (result?.error) {
      setError(result.error);
      setPending(false);
    }
  }

  return (
    <main className="quiver-public min-h-screen">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center gap-8 p-4 md:flex-row md:items-start md:p-8">
        <div className="flex-1 md:pt-8">
          <p className="text-sm uppercase tracking-[0.25em] text-[#D4AF37]">
            Quiver
          </p>
          <h1 className="mt-3 text-3xl font-bold text-[#E8C766] md:text-4xl">
            Agentic nanopayments on Arc
          </h1>
          <p className="mt-4 max-w-lg text-[#EDE6D6]/80">
            Archer sells signals over x402. Scout buys with real cost-benefit
            logic. Try one demo settlement below — then sign in to watch money
            move on the dashboard.
          </p>
          <div className="mt-8">
            <TryQuiverPanel />
          </div>
          <p className="mt-4 text-xs text-[#EDE6D6]/50">
            Share{" "}
            <a href="/try" className="text-[#D4AF37] hover:underline">
              /try
            </a>{" "}
            for a public demo link (works while signed out).
          </p>
        </div>

        <Card className="w-full max-w-sm border-[#7A5C1E]/40 bg-[#0B0B0D] text-[#EDE6D6]">
          <CardHeader>
            <CardTitle className="text-xl text-[#E8C766]">Dashboard</CardTitle>
            <p className="text-sm text-[#EDE6D6]/70">
              Operator sign-in — demo buys and Scout payments appear separately.
            </p>
          </CardHeader>
          <CardContent>
            <form action={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="Email"
                  required
                  className="border-[#7A5C1E]/40 bg-[#0B0B0D] text-[#EDE6D6]"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="Password"
                  required
                  className="border-[#7A5C1E]/40 bg-[#0B0B0D] text-[#EDE6D6]"
                />
              </div>
              {error && (
                <p className="text-sm text-red-300">{error}</p>
              )}
              <Button
                type="submit"
                disabled={pending}
                variant="outline"
                className="w-full border-[#D4AF37] text-[#D4AF37] hover:bg-[#D4AF37]/10"
              >
                {pending ? "Signing in..." : "Sign in to dashboard"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
