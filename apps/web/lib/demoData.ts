// Demo/preview data — static mock, never touches DB or real API.
// This file is the ONLY data source for /demo. No fetch() here, no import of supabase.
// Verifiable: grep -r "fetch.*api" apps/web/app/demo → 0, grep -r "supabase" apps/web/app/demo → 0

export interface DemoProject {
  id: string;
  name: string;
  description: string;
  owner: string;
  ownerHandle: string;
  status: 'active' | 'draft';
  createdAt: string;
  likes: number;
  comments: number;
  funders: number;
  treasuryEth: string;
}

export interface DemoArticle {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  body: string;
  author: string;
  authorHandle: string;
  publishedAt: string;
  likes: number;
  comments: number;
  projectId: string | null;
}

export const DEMO_USER = {
  handle: 'demo-researcher',
  displayName: 'Demo Researcher',
  bio: 'Example profile — shows what your profile looks like. Create button is visible here.',
  avatarInitial: 'D',
};

export const DEMO_PROJECTS: DemoProject[] = [
  {
    id: 'demo-1',
    name: 'CRISPR off-target audit in maize',
    description: 'Systematic GUIDE-seq + rhAmpSeq validation of 12 sgRNAs targeting the ZmWUS locus. Open dataset: 4.2M reads, annotated off-targets, and a living protocol for community replication.',
    owner: 'M. Alvarez',
    ownerHandle: 'malvarez',
    status: 'active',
    createdAt: '2026-09-10',
    likes: 24,
    comments: 8,
    funders: 11,
    treasuryEth: '3.2 ETH',
  },
  {
    id: 'demo-2',
    name: 'Open climate sensor network — Amazon edge',
    description: 'Low-cost LoRa + BME280 mesh across 50km² of transitional forest. Live dashboard, calibration logs, and a field guide for rebuilding nodes from local parts.',
    owner: 'K. Okafor',
    ownerHandle: 'kokafor',
    status: 'active',
    createdAt: '2026-09-08',
    likes: 18,
    comments: 5,
    funders: 7,
    treasuryEth: '1.8 ETH',
  },
  {
    id: 'demo-3',
    name: 'Decentralized peer review: a field trial',
    description: 'Running open, signed reviews on 30 preprints with reviewer reputation staking. Data: review time, agreement scores, and follow-up citation curves.',
    owner: 'J. Park & S. Lee',
    ownerHandle: 'jpark',
    status: 'active',
    createdAt: '2026-09-05',
    likes: 31,
    comments: 12,
    funders: 14,
    treasuryEth: '4.1 ETH',
  },
  {
    id: 'demo-4',
    name: 'Mycelial biomaterials — compression dataset',
    description: 'Myco-composite bricks grown on hemp + coffee grounds, tested to failure. 180 samples, stress-strain curves, and a repeatable growth protocol for low-resource labs.',
    owner: 'R. Haddad',
    ownerHandle: 'rhaddad',
    status: 'active',
    createdAt: '2026-09-01',
    likes: 9,
    comments: 3,
    funders: 4,
    treasuryEth: '0.9 ETH',
  },
  {
    id: 'demo-5',
    name: 'Quantum error correction notes — surface code',
    description: 'Annotated walkthrough of distance-5 surface code with Stim simulations. Notebooks, error-budget tables, and a reading list for newcomers.',
    owner: 'A. Nouri',
    ownerHandle: 'anouri',
    status: 'active',
    createdAt: '2026-08-28',
    likes: 42,
    comments: 15,
    funders: 19,
    treasuryEth: '5.6 ETH',
  },
];

export const DEMO_ARTICLES: DemoArticle[] = [
  {
    id: 'demo-a1',
    slug: 'crispr-audit-notes',
    title: 'What we missed in the first CRISPR audit',
    subtitle: 'Three off-targets that survived our filters — and what changed.',
    body: 'In the first pass we filtered on CFD > 0.2. The surviving off-targets all shared a bulged PAM...',
    author: 'M. Alvarez',
    authorHandle: 'malvarez',
    publishedAt: '2026-09-11',
    likes: 12,
    comments: 4,
    projectId: 'demo-1',
  },
  {
    id: 'demo-a2',
    slug: 'sensor-calibration',
    title: 'Calibrating cheap sensors in the field',
    subtitle: 'A 5-minute routine that cuts drift by 40%.',
    body: 'We co-locate each BME280 with a reference for 24h, then fit a piecewise linear correction...',
    author: 'K. Okafor',
    authorHandle: 'kokafor',
    publishedAt: '2026-09-09',
    likes: 7,
    comments: 2,
    projectId: 'demo-2',
  },
];
