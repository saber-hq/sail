import type { PublicKey } from "@solana/web3.js";
import { EventEmitter as Emitter } from "eventemitter3";
import { startTransition } from "react";

import { getCacheKeyOfPublicKey } from ".";

/**
 * Emitted when the cache is updated.
 */
export class CacheBatchUpdateEvent {
  static type = "CacheBatchUpdate";

  constructor(readonly ids: ReadonlySet<string>) {}

  /**
   * Construct an event from keys.
   * @param keys
   * @returns
   */
  static fromKeys(keys: readonly PublicKey[]) {
    return new CacheBatchUpdateEvent(
      new Set([...keys.map((k) => getCacheKeyOfPublicKey(k))]),
    );
  }

  /**
   * Returns true if the key was present in the batch.
   * @param key
   * @returns
   */
  hasKey(key: PublicKey) {
    return this.ids.has(key.toString());
  }
}

export class CacheClearEvent {
  static type = "CacheDelete";
}

export class AccountsEmitter {
  private readonly _emitter = new Emitter();

  onBatchCache = (
    callback: (args: CacheBatchUpdateEvent) => void,
  ): (() => void) => {
    this._emitter.on(CacheBatchUpdateEvent.type, callback);
    return () =>
      this._emitter.removeListener(CacheBatchUpdateEvent.type, callback);
  };

  raiseBatchCacheUpdated(ids: ReadonlySet<string>): void {
    startTransition(() => {
      this._emitter.emit(
        CacheBatchUpdateEvent.type,
        new CacheBatchUpdateEvent(ids),
      );
    });
  }

  raiseCacheCleared(): void {
    startTransition(() => {
      this._emitter.emit(CacheClearEvent.type, new CacheClearEvent());
    });
  }
}
