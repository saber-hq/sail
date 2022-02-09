import type { PublicKey } from "@solana/web3.js";
import { EventEmitter as Emitter } from "eventemitter3";

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
      new Set([...keys.map((k) => getCacheKeyOfPublicKey(k))])
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

export class CacheUpdateEvent {
  static type = "CacheUpdate";
  id: PublicKey;
  isNew: boolean;
  constructor(id: PublicKey, isNew: boolean) {
    this.id = id;
    this.isNew = isNew;
  }
}

export class CacheDeleteEvent {
  static type = "CacheUpdate";
  id: PublicKey;
  constructor(id: PublicKey) {
    this.id = id;
  }
}

export class CacheClearEvent {
  static type = "CacheDelete";
}

export class AccountsEmitter {
  private readonly _emitter = new Emitter();

  onBatchCache(callback: (args: CacheBatchUpdateEvent) => void): () => void {
    this._emitter.on(CacheBatchUpdateEvent.type, callback);
    return () =>
      this._emitter.removeListener(CacheBatchUpdateEvent.type, callback);
  }

  onCache(callback: (args: CacheUpdateEvent) => void): () => void {
    this._emitter.on(CacheUpdateEvent.type, callback);
    return () => this._emitter.removeListener(CacheUpdateEvent.type, callback);
  }

  raiseBatchCacheUpdated(ids: ReadonlySet<string>): void {
    this._emitter.emit(
      CacheBatchUpdateEvent.type,
      new CacheBatchUpdateEvent(ids)
    );
  }

  raiseCacheUpdated(id: PublicKey, isNew: boolean): void {
    this._emitter.emit(CacheUpdateEvent.type, new CacheUpdateEvent(id, isNew));
  }

  raiseCacheDeleted(id: PublicKey): void {
    this._emitter.emit(CacheDeleteEvent.type, new CacheDeleteEvent(id));
  }

  raiseCacheCleared(): void {
    this._emitter.emit(CacheClearEvent.type, new CacheClearEvent());
  }
}
