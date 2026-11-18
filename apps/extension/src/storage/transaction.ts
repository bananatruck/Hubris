/** Observe completion before the first request can reject. */
export async function withTransaction<T>(
  tx: { done: Promise<void>; abort: () => void },
  run: () => Promise<T>,
): Promise<T> {
  const settled = tx.done.catch(() => {});
  try {
    const result = await run();
    await tx.done;
    return result;
  } catch (cause) {
    try {
      tx.abort();
    } catch {
      // The transaction may already have aborted or completed.
    }
    await settled;
    throw cause;
  }
}
