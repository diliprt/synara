import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Effect, Exit, Option, Scope } from "effect";
import { describe, expect, it } from "vitest";

/**
 * #483: v0.6.3 wrapped adapter.startSession in Effect.timeoutOption. That race
 * runs startSession on a short-lived fiber; forking the ACP session/update
 * consumer with forkChild ties it to that fiber, so the consumer is interrupted
 * the moment startup succeeds and every later agent_message_chunk is dropped.
 *
 * Fix (main / v0.6.4): fork the drain with Effect.forkIn(sessionScope) so its
 * lifetime is the session, not the caller's fiber.
 */

const adaptersDir = path.dirname(fileURLToPath(import.meta.url));

function adapterSource(name: "GrokAdapter" | "CursorAdapter" | "DroidAdapter"): string {
  return readFileSync(path.join(adaptersDir, "Layers", `${name}.ts`), "utf8");
}

describe("ACP notification drain scope (#483)", () => {
  it.each(["GrokAdapter", "CursorAdapter", "DroidAdapter"] as const)(
    "%s forks the notification drain into sessionScope, not forkChild",
    (name) => {
      const source = adapterSource(name);
      // The drain must be forked into the long-lived session scope.
      expect(source).toMatch(/Effect\.forkIn\(sessionScope\)/);
      // Guard the historical bug: a child of the startSession fiber dies when
      // ProviderService wraps start in timeoutOption / raceFirst.
      const drainRegion = source.match(
        /session\/update[\s\S]{0,2500}?\.pipe\(\s*Effect\.fork\w+\([^)]*\)\s*\)/,
      );
      // Prefer an explicit sessionScope fork near the notification consumer.
      expect(source).toMatch(
        /\/\*[\s\S]*drain[\s\S]*session[\s\S]*\*\/[\s\S]{0,400}?forkIn\(sessionScope\)|forkIn\(sessionScope\)/,
      );
      if (drainRegion) {
        expect(drainRegion[0]).toContain("forkIn(sessionScope)");
        expect(drainRegion[0]).not.toContain("forkChild");
      }
    },
  );

  it("documents why forkChild under timeoutOption drops the consumer", async () => {
    const run = (
      wrap: <A, E, R>(effect: Effect.Effect<A, E, R>) => Effect.Effect<A, E, R>,
    ) =>
      Effect.gen(function* () {
        let ticks = 0;
        const startSession = Effect.gen(function* () {
          yield* Effect.gen(function* () {
            while (true) {
              yield* Effect.sleep("20 millis");
              ticks += 1;
            }
          }).pipe(Effect.forkChild);
          yield* Effect.sleep("20 millis");
          return "started" as const;
        });
        yield* wrap(startSession);
        yield* Effect.sleep("200 millis");
        return ticks;
      });

    const inlineTicks = await Effect.runPromise(run((effect) => effect));
    const timedTicks = await Effect.runPromise(
      run((effect) =>
        effect.pipe(
          Effect.timeoutOption("5 seconds"),
          Effect.flatMap((option) =>
            Option.isSome(option)
              ? Effect.succeed(option.value)
              : Effect.fail(new Error("startSession timed out in test harness")),
          ),
        ),
      ),
    );

    // Pre-0.6.3 style: consumer stays alive after start returns.
    expect(inlineTicks).toBeGreaterThan(0);
    // 0.6.3 style: timeoutOption races startSession; forkChild dies with it.
    expect(timedTicks).toBe(0);
  });

  it("keeps the consumer alive when forked into a session scope", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const sessionScope = yield* Scope.make("sequential");
        let ticks = 0;

        const startSession = Effect.gen(function* () {
          yield* Effect.gen(function* () {
            while (true) {
              yield* Effect.sleep("20 millis");
              ticks += 1;
            }
          }).pipe(Effect.forkIn(sessionScope));
          yield* Effect.sleep("20 millis");
          return "started" as const;
        });

        // Same caller wrapping that killed forkChild consumers in v0.6.3.
        yield* startSession.pipe(
          Effect.timeoutOption("5 seconds"),
          Effect.flatMap((option) =>
            Option.isSome(option)
              ? Effect.succeed(option.value)
              : Effect.fail(new Error("startSession timed out in test harness")),
          ),
        );
        yield* Effect.sleep("200 millis");
        yield* Scope.close(sessionScope, Exit.void);
        return ticks;
      }),
    );

    expect(result).toBeGreaterThan(0);
  });
});
