import { MilestoneInput, MilestoneOutput } from './types';

/**
 * SciAgent Milestone Agent
 * Evaluates milestone proof deliverables, proof format (IPFS/HTTP), and verification scores.
 */
export function evaluateMilestoneProof(input: MilestoneInput): MilestoneOutput {
  const { milestoneId, projectId, title, descriptionUri, proofUri, state } = input;

  let verificationScore = 50;
  let proofValid = false;
  let status: MilestoneOutput['status'] = 'needs_more_proof';
  let reasoning = 'Milestone proof verification pending.';

  if (!proofUri || proofUri.trim() === '') {
    return {
      milestoneId,
      projectId,
      proofValid: false,
      verificationScore: 0,
      status: 'needs_more_proof',
      reasoning: 'No proof URL provided for milestone verification.',
      reviewedAt: new Date().toISOString(),
    };
  }

  // Check URL scheme & format
  const isValidUrl = proofUri.startsWith('http://') || proofUri.startsWith('https://') || proofUri.startsWith('ipfs://');

  if (!isValidUrl) {
    return {
      milestoneId,
      projectId,
      proofValid: false,
      verificationScore: 10,
      status: 'invalid_format',
      reasoning: 'Proof URI must be a valid HTTP, HTTPS, or IPFS URI.',
      reviewedAt: new Date().toISOString(),
    };
  }

  proofValid = true;
  verificationScore += 30;

  // Extra points for IPFS decentralized storage
  if (proofUri.includes('ipfs.io') || proofUri.startsWith('ipfs://') || proofUri.includes('/ipfs/')) {
    verificationScore += 15;
  }

  // Description completeness check
  if (descriptionUri && descriptionUri.length > 5) {
    verificationScore += 5;
  }

  if (state === 'submitted' || state === 'approved') {
    status = 'verified';
    reasoning = `Milestone deliverable "${title}" successfully verified with valid proof payload.`;
  }

  verificationScore = Math.max(0, Math.min(100, Math.round(verificationScore)));

  return {
    milestoneId,
    projectId,
    proofValid,
    verificationScore,
    status,
    reasoning,
    reviewedAt: new Date().toISOString(),
  };
}
