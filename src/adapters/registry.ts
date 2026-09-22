import { RetailerAdapter } from './base';
import { MediaMarktEsAdapter } from './mediamarkt-es';
import { FnacEsAdapter } from './fnac-es';
import { AmazonEsAdapter } from './amazon-es';
import { ElCorteInglesEsAdapter } from './elcorteingles-es';
import { RetailerConfig } from '../domain/retailer';
import { ProductIdentity } from '../domain/product';

type AdapterConstructor = new (config: RetailerConfig, product: ProductIdentity) => RetailerAdapter;

const ADAPTER_CONSTRUCTORS: Record<string, AdapterConstructor> = {
  'mediamarkt-es': MediaMarktEsAdapter,
  'fnac-es': FnacEsAdapter,
  'amazon-es': AmazonEsAdapter,
  'elcorteingles-es': ElCorteInglesEsAdapter,
};

export function buildAdapters(configs: RetailerConfig[], product: ProductIdentity): RetailerAdapter[] {
  return configs
    .filter((config) => config.enabled)
    .map((config) => {
      const Adapter = ADAPTER_CONSTRUCTORS[config.id];
      if (!Adapter) {
        throw new Error(`No adapter implementation registered for retailer id "${config.id}"`);
      }
      return new Adapter(config, product);
    });
}
