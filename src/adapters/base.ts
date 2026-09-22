import { ProductAvailability, RetailerConfig } from '../domain/retailer';
import { ProductIdentity } from '../domain/product';

export abstract class RetailerAdapter {
  abstract readonly id: string;
  abstract readonly name: string;

  constructor(
    protected readonly config: RetailerConfig,
    protected readonly product: ProductIdentity,
  ) {}

  /** Performs the live HTTP request and returns the current availability. */
  abstract check(): Promise<ProductAvailability>;

  protected unknown(partial: Partial<ProductAvailability> = {}): ProductAvailability {
    return {
      retailerId: this.id,
      status: 'UNKNOWN',
      productVerified: false,
      productUrl: this.config.productUrl,
      checkedAt: new Date().toISOString(),
      evidence: [],
      ...partial,
    };
  }
}
