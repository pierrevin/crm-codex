/** Étapes opportunité — libellés et couleurs graphiques alignés sur le dashboard. */
export const OPPORTUNITY_STAGES = {
  QUALIFICATION: { label: 'Qualification', chartColor: '#3b82f6' },
  PROPOSAL: { label: 'Proposition', chartColor: '#a855f7' },
  CLOSED_WON: { label: 'Gagné', chartColor: '#22c55e' },
  FINALIZED: { label: 'Finalisé / réglé', chartColor: '#f59e0b' },
  CLOSED_LOST: { label: 'Perdu', chartColor: '#f43f5e' }
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
