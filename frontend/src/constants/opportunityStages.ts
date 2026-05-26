/**
 * Palette unifiée des étapes opportunité (dashboard, kanban, graphiques).
 * Tons slate → indigo → emerald → teal, rose pour perdu.
 */
export const OPPORTUNITY_STAGES = {
  QUALIFICATION: {
    label: 'Qualification',
    chartColor: '#94a3b8',
    barClass: 'bg-slate-400',
    badgeClass: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200/80'
  },
  PROPOSAL: {
    label: 'Proposition',
    chartColor: '#6366f1',
    barClass: 'bg-indigo-500',
    badgeClass: 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200/80'
  },
  CLOSED_WON: {
    label: 'Gagné',
    chartColor: '#10b981',
    barClass: 'bg-emerald-500',
    badgeClass: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/80'
  },
  FINALIZED: {
    label: 'Finalisé / réglé',
    chartColor: '#14b8a6',
    barClass: 'bg-teal-500',
    badgeClass: 'bg-teal-50 text-teal-700 ring-1 ring-teal-200/80'
  },
  CLOSED_LOST: {
    label: 'Perdu',
    chartColor: '#fb7185',
    barClass: 'bg-rose-400',
    badgeClass: 'bg-rose-50 text-rose-600 ring-1 ring-rose-200/80'
  }
} as const;

/** Étape legacy (vue trésorerie uniquement). */
export const NEGOTIATION_STAGE = {
  label: 'Négociation',
  chartColor: '#8b5cf6',
  barClass: 'bg-violet-400',
  badgeClass: 'bg-violet-50 text-violet-700 ring-1 ring-violet-200/80'
} as const;

export type OpportunityStageId = keyof typeof OPPORTUNITY_STAGES;

export const STAGE_DISPLAY_ORDER: OpportunityStageId[] = [
  'QUALIFICATION',
  'PROPOSAL',
  'CLOSED_WON',
  'FINALIZED',
  'CLOSED_LOST'
];

/** Étapes cochées par défaut sur le tableau de bord. */
export const DEFAULT_DASHBOARD_STAGES: OpportunityStageId[] = [
  'PROPOSAL',
  'CLOSED_WON',
  'FINALIZED'
];

export function getStageConfig(stage: string) {
  if (stage in OPPORTUNITY_STAGES) {
    return OPPORTUNITY_STAGES[stage as OpportunityStageId];
  }
  if (stage === 'NEGOTIATION') {
    return NEGOTIATION_STAGE;
  }
  return null;
}

export function getStageLabel(stage: string): string {
  return getStageConfig(stage)?.label ?? stage;
}

export function getStageBadgeClass(stage: string): string {
  return getStageConfig(stage)?.badgeClass ?? 'bg-slate-100 text-slate-600 ring-1 ring-slate-200/80';
}

export function getStageBarClass(stage: string): string {
  return getStageConfig(stage)?.barClass ?? 'bg-slate-300';
}
