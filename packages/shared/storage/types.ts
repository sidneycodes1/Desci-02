export interface PinataUploadMetadata {
  name?: string;
  keyvalues?: Record<string, string | number | boolean>;
}

export interface PinataUploadOptions {
  fileName?: string;
  contentType?: string;
  metadata?: PinataUploadMetadata;
  pinataOptions?: {
    cidVersion?: 0 | 1;
    groupId?: string;
    hostNodes?: string[];
  };
}

export interface PinataUploadResult {
  cid: string;
  url: string;
  gatewayUrl: string;
}

export interface PinataClientConfig {
  jwt: string;
  gatewayUrl?: string;
}
