import { describe, expect, it } from 'vitest';
import React from 'react';
import { Button, Badge, Card } from '../src';

describe('@sciagent/ui Components', () => {
  it('exports Button, Badge, Card components', () => {
    expect(Button).toBeDefined();
    expect(Badge).toBeDefined();
    expect(Card).toBeDefined();
  });
});
