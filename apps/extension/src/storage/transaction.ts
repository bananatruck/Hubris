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

interface MetaStore {
  get(key: string): Promise<boolean | number | string | undefined>;
  put(value: boolean | number | string, key: string): Promise<IDBValidKey>;
}

/** How many imports have changed this database. Undo handles compare it to block Undo after an import. */
export async function readImportGeneration(meta: Pick<MetaStore, 'get'>) {
  const current = await meta.get('importGeneration');
  return typeof current === 'number' ? current : 0;
}

export async function incrementDataRevision(meta: MetaStore) {
  const current = await meta.get('dataRevision');
  const next = (typeof current === 'number' ? current : 0) + 1;
  await meta.put(next, 'dataRevision');
  return next;
}
