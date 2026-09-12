import { describe, expect, it } from 'vitest';

import {
  createResearchLogSchema,
  updateResearchLogSchema,
  ALLOWED_EVIDENCE_MIME_TYPES,
  MAX_EVIDENCE_FILE_SIZE_BYTES,
} from '../researchLog';

describe('Research Log Validation Schemas', () => {
  it('validates a correct research log input', () => {
    const input = {
      title: 'Lab Observation Week 1',
      content: 'Successfully synthesized sample compound A-42.',
      evidenceCid: 'QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco',
      evidenceMimeType: 'application/pdf',
      evidenceSizeBytes: 1024 * 500, // 500 KB
    };

    const result = createResearchLogSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBe('Lab Observation Week 1');
      expect(result.data.evidenceMimeType).toBe('application/pdf');
    }
  });

  it('rejects empty title or content', () => {
    const resultTitle = createResearchLogSchema.safeParse({
      title: '',
      content: 'Valid content',
    });
    expect(resultTitle.success).toBe(false);

    const resultContent = createResearchLogSchema.safeParse({
      title: 'Valid title',
      content: '',
    });
    expect(resultContent.success).toBe(false);
  });

  it('rejects unsupported evidence MIME type', () => {
    const result = createResearchLogSchema.safeParse({
      title: 'Title',
      content: 'Content',
      evidenceMimeType: 'video/mp4', // Unsupported
    });
    expect(result.success).toBe(false);
  });

  it('rejects oversized evidence file size exceeding 10MB', () => {
    const result = createResearchLogSchema.safeParse({
      title: 'Title',
      content: 'Content',
      evidenceSizeBytes: MAX_EVIDENCE_FILE_SIZE_BYTES + 1,
    });
    expect(result.success).toBe(false);
  });

  it('allows valid optional evidence upload file types', () => {
    ALLOWED_EVIDENCE_MIME_TYPES.forEach((mime) => {
      const result = createResearchLogSchema.safeParse({
        title: 'Title',
        content: 'Content',
        evidenceMimeType: mime,
      });
      expect(result.success).toBe(true);
    });
  });

  it('validates update research log schema', () => {
    const result = updateResearchLogSchema.safeParse({
      title: 'Updated Title',
    });
    expect(result.success).toBe(true);
  });
});
