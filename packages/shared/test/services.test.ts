import { describe, expect, it } from 'vitest';

import { createServiceRegistry } from '../src/services';

describe('service registry', () => {
  it('throws when a required service is missing', () => {
    const registry = createServiceRegistry({});

    expect(() => registry.require('ai')).toThrow('Missing service: ai');
  });

  it('reports when a service exists', () => {
    const logger = {
      debug() {},
      info() {},
      warn() {},
      error() {},
      child() {
        return logger;
      }
    };

    const registry = createServiceRegistry({
      monitoring: {
        kind: 'monitoring',
        logger
      }
    });

    expect(registry.has('monitoring')).toBe(true);
  });
});
