import type {
  AccountInfoFetcher,
  Provider,
  PublicKey,
} from "@saberhq/solana-contrib";
import { SolanaAugmentedProvider } from "@saberhq/solana-contrib";
import type { AccountInfo, KeyedAccountInfo } from "@solana/web3.js";
import type DataLoader from "dataloader";

export class SailBatchProvider extends SolanaAugmentedProvider {
  readonly fetcher: AccountInfoFetcher;

  constructor(
    override readonly provider: Provider,
    readonly loader: DataLoader<PublicKey, AccountInfo<Buffer> | null, string>,
  ) {
    super(provider);
    this.fetcher = new SailBatchFetcher(loader);
  }

  override async getAccountInfo(
    accountId: PublicKey,
  ): Promise<KeyedAccountInfo | null> {
    const data = await this.loader.load(accountId);
    if (!data) {
      return null;
    }
    return {
      accountId,
      accountInfo: data,
    };
  }
}

export class SailBatchFetcher implements AccountInfoFetcher {
  constructor(
    readonly loader: DataLoader<PublicKey, AccountInfo<Buffer> | null, string>,
  ) {}

  async getAccountInfo(accountId: PublicKey): Promise<KeyedAccountInfo | null> {
    const data = await this.loader.load(accountId);
    if (!data) {
      return null;
    }
    return {
      accountId,
      accountInfo: data,
    };
  }
}
