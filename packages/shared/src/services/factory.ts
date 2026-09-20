import type { ServiceRegistry } from './types';

export function createServiceRegistry(services: ServiceRegistry) {
  return {
    ...services,
    has(serviceName: keyof ServiceRegistry) {
      return Boolean(services[serviceName]);
    },
    require<ServiceName extends keyof ServiceRegistry>(serviceName: ServiceName) {
      const service = services[serviceName];

      if (!service) {
        throw new Error(`Missing service: ${String(serviceName)}`);
      }

      return service;
    }
  };
}
