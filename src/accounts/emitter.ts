import type { PublicKey } from "@solana/web3.js";
import { EventEmitter as Emitter } from "eventemitter3";

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

  onCache(callback: (args: CacheUpdateEvent) => void): () => void {
    this._emitter.on(CacheUpdateEvent.type, callback);

    return () => this._emitter.removeListener(CacheUpdateEvent.type, callback);
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
