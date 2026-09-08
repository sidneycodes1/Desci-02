import { getClientEnv } from '../env/client';
import { getServerEnv } from '../env/server';
import type { PinataClientConfig, PinataUploadOptions, PinataUploadResult } from './types';

export function createPinataGatewayUrl(cidOrPath: string, gatewayUrl?: string) {
  const env = getClientEnv();
  const defaultGatewayUrl = gatewayUrl ?? env.NEXT_PUBLIC_PINATA_GATEWAY_URL;
  const normalized = cidOrPath.startsWith('ipfs/') ? cidOrPath : `ipfs/${cidOrPath}`;
  return `${defaultGatewayUrl.replace(/\/$/, '')}/${normalized}`;
}

export function createPinataIpfsUrl(cidOrPath: string) {
  return `ipfs://${cidOrPath.replace(/^ipfs:\/\//, '').replace(/^ipfs\//, '')}`;
}

function getPinataAuthHeaders(jwt: string) {
  return {
    Authorization: `Bearer ${jwt}`,
  };
}

export function createPinataClient(config: PinataClientConfig = {}) {
  const env = getServerEnv();
  const jwt = config.jwt ?? env.PINATA_JWT;
  const gatewayUrl = config.gatewayUrl ?? env.PINATA_GATEWAY_URL;

  return {
    async uploadJson<TDocument extends Record<string, unknown>>(
      document: TDocument,
      options: PinataUploadOptions = {}
    ): Promise<PinataUploadResult> {
      const response = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getPinataAuthHeaders(jwt),
        },
        body: JSON.stringify({
          pinataContent: document,
          pinataMetadata: options.metadata,
          pinataOptions: options.pinataOptions,
        }),
      });

      if (!response.ok) {
        throw new Error(`Pinata JSON upload failed: ${response.status} ${response.statusText}`);
      }

      const payload = (await response.json()) as { IpfsHash?: string };
      const cid = payload.IpfsHash ?? '';

      return {
        cid,
        url: createPinataIpfsUrl(cid),
        gatewayUrl: createPinataGatewayUrl(cid, gatewayUrl),
      };
    },
    async uploadFile(file: Blob, options: PinataUploadOptions = {}): Promise<PinataUploadResult> {
      const formData = new FormData();
      formData.append('file', file, options.fileName ?? 'upload.bin');

      if (options.metadata) {
        formData.append('pinataMetadata', JSON.stringify(options.metadata));
      }

      if (options.pinataOptions) {
        formData.append('pinataOptions', JSON.stringify(options.pinataOptions));
      }

      const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
        method: 'POST',
        headers: getPinataAuthHeaders(jwt),
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Pinata file upload failed: ${response.status} ${response.statusText}`);
      }

      const payload = (await response.json()) as { IpfsHash?: string };
      const cid = payload.IpfsHash ?? '';

      return {
        cid,
        url: createPinataIpfsUrl(cid),
        gatewayUrl: createPinataGatewayUrl(cid, gatewayUrl),
      };
    },
    gatewayUrl,
  };
}

let _cachedPinataClient: ReturnType<typeof createPinataClient> | null = null;

export function getPinataClient(): ReturnType<typeof createPinataClient> {
  if (!_cachedPinataClient) {
    _cachedPinataClient = createPinataClient();
  }
  return _cachedPinataClient;
}

export function resetPinataClientCache(): void {
  _cachedPinataClient = null;
}

// Lazy proxy for backwards compatibility — does not call getServerEnv() at import time
export const pinataClient = new Proxy({} as ReturnType<typeof createPinataClient>, {
  get(_target, prop) {
    const client = getPinataClient();
    const value = (client as unknown as Record<string | symbol, unknown>)[prop];
    return typeof value === 'function'
      ? (value as (...args: unknown[]) => unknown).bind(client)
      : value;
  },
});
