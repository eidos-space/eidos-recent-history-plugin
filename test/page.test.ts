// @vitest-environment jsdom
import { expect, it, vi } from "vitest"
import mount from "../page"
import type { Disposable } from "@eidos.space/plugin-sdk"

it.each([true, false])(
  "automatically connects (initially running: %s), without recording controls",
  async (initial) => {
    let running = initial
    const disposables: Disposable[] = []
    const dispose = vi.fn()
    const background = {
      start: vi.fn(async () => {
        running = true
      }),
      stop: vi.fn(async () => {}),
      isRunning: vi.fn(async () => running),
      request: vi.fn(async () => ({
        rows: [],
        pending: 0,
        running: true,
        instanceId: "run",
      })),
      onMessage: vi.fn(async () => ({ dispose })),
    }
    const root = document.createElement("div")
    mount(
      {
        capabilities: { background },
        subscriptions: { add: (value: Disposable) => disposables.push(value) },
      } as unknown as Parameters<typeof mount>[0],
      root
    )
    try {
      await vi.waitFor(() =>
        expect(root.querySelector("[data-status]")!.textContent).toBe("")
      )
      expect(background.start).toHaveBeenCalledTimes(initial ? 0 : 1)
      expect(root.querySelector("[data-start]")).toBeNull()
      expect(root.querySelector("[data-save]")).toBeNull()
      expect(root.querySelector("[data-run]")).toBeNull()
      expect(root.querySelector("[data-stop]")).toBeNull()
      expect(background.onMessage).toHaveBeenCalledTimes(1)
      const calls = background.request.mock.calls.length
      running = false
      await vi.waitFor(
        () =>
          expect(root.querySelector("[data-status]")!.textContent).toContain(
            "暂不可用"
          ),
        { timeout: 3000 }
      )
      expect(background.start).toHaveBeenCalledTimes(initial ? 0 : 1)
      expect(background.request).toHaveBeenCalledTimes(calls)
    } finally {
      disposables.forEach((item) => item.dispose())
    }
    expect(background.stop).not.toHaveBeenCalled()
    expect(dispose).toHaveBeenCalledTimes(1)
  }
)
