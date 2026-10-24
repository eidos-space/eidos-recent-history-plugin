import { expect, it, vi } from "vitest"
import {
  HistoryLedger,
  mergeRows,
} from "../history"

it("deduplicates deliveries and keeps events received during a write dirty", async () => {
  let finish!: () => void
  const write = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve
      })
  )
  const ledger = new HistoryLedger(write)
  const event = { id: "a", path: "a.md", openedAt: 1 }
  ledger.record(event)
  ledger.record(event)
  const saving = ledger.flush()
  ledger.record({ ...event, id: "b", openedAt: 2 })
  finish()
  await saving
  expect(write).toHaveBeenCalledWith([
    { path: "a.md", count: 1, lastOpenedAt: 1 },
  ])
  expect(ledger.pending).toBe(1)
  const again = ledger.flush()
  finish()
  await again
  expect(ledger.pending).toBe(0)
  expect(ledger.snapshot()).toEqual([
    { path: "a.md", count: 2, lastOpenedAt: 2 },
  ])
})

it("retains unsaved records on failure and merges persisted runs on restart", async () => {
  const write = vi
    .fn()
    .mockRejectedValueOnce(new Error("disk full"))
    .mockResolvedValue(undefined)
  const ledger = new HistoryLedger(write)
  ledger.record({ id: "a", path: "a.md", openedAt: 20 })
  await expect(ledger.flush()).rejects.toThrow("disk full")
  expect(ledger.pending).toBe(1)
  expect(ledger.error).toBe("disk full")
  await ledger.flush()
  expect(ledger.pending).toBe(0)
  expect(ledger.error).toBeNull()
  expect(
    mergeRows([
      [{ path: "a.md", count: 3, lastOpenedAt: 10 }],
      ledger.snapshot(),
    ])
  ).toEqual([{ path: "a.md", count: 4, lastOpenedAt: 20 }])
})
