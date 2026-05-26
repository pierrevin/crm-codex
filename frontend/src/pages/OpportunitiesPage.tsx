import { useEffect, useState, useMemo, useRef } from 'react';
import { PlusIcon, CurrencyEuroIcon, MagnifyingGlassIcon, BuildingOfficeIcon, ChevronLeftIcon, ChevronRightIcon, ArrowsPointingOutIcon } from '@heroicons/react/24/outline';

import api from '../services/apiClient';
import { CompanySearchSelect } from '../components/CompanySearchSelect';
import { ContactSearchSelect } from '../components/ContactSearchSelect';
import { MultiplePaymentsModal } from '../components/MultiplePaymentsModal';
import { paymentService, Payment } from '../services/paymentService';
import { EffectiveSalesSection } from '../components/EffectiveSalesSection';
import {
  OPPORTUNITY_STAGES,
  type OpportunityStageId
} from '../constants/opportunityStages';

type Opportunity = {
  id: string;
  title: string;
  stage: 'QUALIFICATION' | 'PROPOSAL' | 'CLOSED_WON' | 'FINALIZED' | 'CLOSED_LOST';
  companyId?: string;
  amount?: number;
  closeDate?: string;
  expectedPaymentDate?: string;
  taxRate?: number;
  contact?: { id: string; firstName: string; lastName?: string } | null;
  company?: { id: string; name: string } | null;
};

type PaginatedResponse<T> = {
  data?: T[];
  items?: T[];
  nextCursor?: string | null;
  total?: number;
};

const STAGES = OPPORTUNITY_STAGES;

const KANBAN_COLLAPSED_STAGES_STORAGE_KEY = 'opportunities.kanban.collapsedStages.v1';

export function OpportunitiesPage() {
  const [allOpportunities, setAllOpportunities] = useState<Opportunity[]>([]);
  const [allCompaniesWithActiveOpps, setAllCompaniesWithActiveOpps] = useState<any[]>([]);
  const [companyQuery, setCompanyQuery] = useState('');
  const [companyResults, setCompanyResults] = useState<any[]>([]);
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(false);
  const [showCompanyResults, setShowCompanyResults] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [selectedCompanyName, setSelectedCompanyName] = useState<string>('');
  const [view, setView] = useState<'kanban' | 'list'>('kanban');
  const [showModal, setShowModal] = useState(false);
  const [draggedOpp, setDraggedOpp] = useState<Opportunity | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedOpportunity, setSelectedOpportunity] = useState<Opportunity | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const companySearchRef = useRef<HTMLDivElement>(null);
  const companyInputRef = useRef<HTMLInputElement>(null);
  const [collapsedStageOverrides, setCollapsedStageOverrides] = useState<Partial<Record<keyof typeof STAGES, boolean>>>({});

  // Stages actifs (qualification, proposition, gagné)
  const activeStages: (keyof typeof STAGES)[] = ['QUALIFICATION', 'PROPOSAL', 'CLOSED_WON'];

  useEffect(() => {
    void loadOpportunities();
    void loadPayments();
  }, []);

  // Charger les préférences de repli (override manuel)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KANBAN_COLLAPSED_STAGES_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const next: Partial<Record<keyof typeof STAGES, boolean>> = {};
      (Object.keys(STAGES) as (keyof typeof STAGES)[]).forEach((stage) => {
        const v = parsed[stage as string];
        if (typeof v === 'boolean') next[stage] = v;
      });
      setCollapsedStageOverrides(next);
    } catch {
      // no-op
    }
  }, []);

  // Persister les préférences de repli
  useEffect(() => {
    try {
      localStorage.setItem(KANBAN_COLLAPSED_STAGES_STORAGE_KEY, JSON.stringify(collapsedStageOverrides));
    } catch {
      // no-op
    }
  }, [collapsedStageOverrides]);


  // Fermer le dropdown quand on clique en dehors
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (companySearchRef.current && !companySearchRef.current.contains(event.target as Node)) {
        setShowCompanyResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadOpportunities = async () => {
    try {
      const { data } = await api.get<PaginatedResponse<Opportunity>>('/api/opportunities?limit=1000');
      const opps = data.items || data.data || [];
      setAllOpportunities(opps);
      
      // Extraire les entreprises qui ont des opportunités actives
      const companiesWithActiveOpps = new Set<string>();
      opps.forEach((opp: Opportunity) => {
        const cid = opp.company?.id ?? opp.companyId;
        if (activeStages.includes(opp.stage) && cid) {
          companiesWithActiveOpps.add(cid);
        }
      });
      
      // Charger les entreprises correspondantes
      const { data: companiesData } = await api.get('/api/companies');
      const allCompanies = Array.isArray(companiesData) ? companiesData : (companiesData.items || companiesData.data || []);
      const filteredCompanies = allCompanies.filter((c: any) => companiesWithActiveOpps.has(c.id));
      setAllCompaniesWithActiveOpps(filteredCompanies);
    } catch (error) {
      console.error('Erreur chargement opportunités:', error);
      setAllOpportunities([]);
      setAllCompaniesWithActiveOpps([]);
    }
  };

  // Recherche d'entreprises avec debounce (comme GlobalSearch)
  useEffect(() => {
    if (!companyQuery.trim()) {
      setCompanyResults([]);
      setShowCompanyResults(false);
      return;
    }

    setIsLoadingCompanies(true);
    setShowCompanyResults(true);

    const timeoutId = setTimeout(() => {
      try {
        const term = companyQuery.toLowerCase();
        const filtered = allCompaniesWithActiveOpps.filter((company: any) =>
          company.name.toLowerCase().includes(term)
        );
        setCompanyResults(filtered.slice(0, 10)); // Limiter à 10 résultats
      } catch (error) {
        console.error('Erreur recherche entreprises:', error);
        setCompanyResults([]);
      } finally {
        setIsLoadingCompanies(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [companyQuery, allCompaniesWithActiveOpps]);

  // Filtrer les opportunités selon l'entreprise sélectionnée
  const opportunities = useMemo(() => {
    if (!selectedCompanyId) {
      return allOpportunities;
    }
    return allOpportunities.filter(opp => (opp.company?.id ?? opp.companyId) === selectedCompanyId);
  }, [allOpportunities, selectedCompanyId]);

  const handleCompanySelect = (company: any) => {
    setSelectedCompanyId(company.id);
    setSelectedCompanyName(company.name);
    setCompanyQuery('');
    setShowCompanyResults(false);
    companyInputRef.current?.blur();
  };

  const handleCompanyClear = () => {
    setSelectedCompanyId(null);
    setSelectedCompanyName('');
    setCompanyQuery('');
    setShowCompanyResults(false);
  };

  const loadPayments = async () => {
    try {
      const data = await paymentService.getAll();
      setPayments(data);
    } catch (error) {
      console.error('Erreur chargement paiements:', error);
    }
  };

  const handleMarkAsPaid = (opportunity: Opportunity) => {
    setSelectedOpportunity(opportunity);
    setShowPaymentModal(true);
  };

  const handlePaymentSuccess = async () => {
    await loadPayments();
    await loadOpportunities();
    setShowPaymentModal(false);
    setSelectedOpportunity(null);
  };

  const handleDragStart = (opp: Opportunity) => {
    setDraggedOpp(opp);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (newStage: keyof typeof STAGES) => {
    if (!draggedOpp || draggedOpp.stage === newStage) {
      setDraggedOpp(null);
      return;
    }

    try {
      // Mise à jour optimiste
      setAllOpportunities((opps: Opportunity[]) => 
        opps.map((o: Opportunity) => o.id === draggedOpp.id ? { ...o, stage: newStage } : o)
      );

      // Mise à jour API
      await api.patch(`/api/opportunities/${draggedOpp.id}`, { stage: newStage });
    } catch (error) {
      console.error('Erreur mise à jour:', error);
      // Recharger en cas d'erreur
      await loadOpportunities();
    } finally {
      setDraggedOpp(null);
    }
  };

  const opportunitiesByStage = Object.keys(STAGES).reduce((acc, stage) => {
    acc[stage as keyof typeof STAGES] = opportunities
      .filter((o: any) => o.stage === stage)
      .sort((a, b) => {
        if (!a.closeDate && !b.closeDate) return 0;
        if (!a.closeDate) return 1;
        if (!b.closeDate) return -1;
        return new Date(a.closeDate).getTime() - new Date(b.closeDate).getTime();
      });
    return acc;
  }, {} as Record<string, Opportunity[]>);

  const totalByStage = Object.keys(STAGES).reduce((acc, stage) => {
    const stageOpps = opportunitiesByStage[stage] || [];
    acc[stage] = stageOpps.reduce((sum, opp) => sum + (Number(opp.amount) || 0), 0);
    return acc;
  }, {} as Record<string, number>);

  const countsByStage = useMemo(() => {
    const counts: Record<string, number> = {};
    Object.keys(STAGES).forEach((stage) => {
      counts[stage] = opportunitiesByStage[stage]?.length || 0;
    });
    return counts;
  }, [opportunitiesByStage]);

  const isStageCollapsed = (stage: keyof typeof STAGES) => {
    const autoCollapsed = (countsByStage[stage] ?? 0) === 0;
    const override = collapsedStageOverrides[stage];
    return override ?? autoCollapsed;
  };

  const toggleStageCollapsed = (stage: keyof typeof STAGES) => {
    const next = !isStageCollapsed(stage);
    setCollapsedStageOverrides((prev) => ({ ...prev, [stage]: next }));
  };

  const expandAllStages = () => {
    // UX: "Tout déplier" doit maximiser l'info utile.
    // On déplie seulement les colonnes non vides, et on laisse les colonnes vides en auto-repli (compactes).
    const next: Partial<Record<keyof typeof STAGES, boolean>> = {};
    (Object.keys(STAGES) as (keyof typeof STAGES)[]).forEach((stage) => {
      const count = countsByStage[stage] ?? 0;
      if (count > 0) next[stage] = false;
      // si vide: ne pas override -> autoCollapsed restera true
    });
    setCollapsedStageOverrides(next);
  };

  const collapseEmptyStages = () => {
    setCollapsedStageOverrides((prev) => {
      // On remet les colonnes vides en mode "auto" (et donc repliées),
      // sans forcer un repli manuel persistant qui masquerait une future opportunité.
      const next = { ...prev } as Partial<Record<keyof typeof STAGES, boolean>>;
      (Object.keys(STAGES) as (keyof typeof STAGES)[]).forEach((stage) => {
        const isEmpty = (countsByStage[stage] ?? 0) === 0;
        if (isEmpty) {
          delete (next as any)[stage];
        }
      });
      return next;
    });
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-slate-900">Opportunités</h1>
          <p className="text-sm text-slate-500">Suivez vos affaires et leur progression.</p>
        </div>
        <div className="flex gap-2 sm:gap-3">
          <div className="flex rounded-md border border-slate-200 bg-white">
            <button
              onClick={() => setView('kanban')}
              className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium ${view === 'kanban' ? 'bg-slate-100 text-slate-900' : 'text-slate-600'}`}
            >
              Kanban
            </button>
            <button
              onClick={() => setView('list')}
              className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium ${view === 'list' ? 'bg-slate-100 text-slate-900' : 'text-slate-600'}`}
            >
              Liste
            </button>
          </div>
          {view === 'kanban' && (
            <div className="hidden sm:flex items-center gap-2">
              <button
                onClick={collapseEmptyStages}
                className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                title="Replier les colonnes vides"
              >
                <ChevronLeftIcon className="h-4 w-4" />
                Replier vides
              </button>
              <button
                onClick={expandAllStages}
                className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                title="Tout déplier"
              >
                <ArrowsPointingOutIcon className="h-4 w-4" />
                Tout déplier
              </button>
            </div>
          )}
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1 sm:gap-2 rounded-md bg-indigo-600 px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-white shadow hover:bg-indigo-500"
          >
            <PlusIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Nouvelle opportunité</span>
            <span className="sm:hidden">Nouvelle</span>
          </button>
        </div>
      </div>

      {/* Filtre par entreprise - Recherche (style GlobalSearch) */}
      <div ref={companySearchRef} className="relative w-full max-w-2xl">
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
          <input
            ref={companyInputRef}
            type="text"
            value={selectedCompanyName || companyQuery}
            onChange={(e) => {
              const value = e.target.value;
              setCompanyQuery(value);
              if (selectedCompanyId) {
                handleCompanyClear();
              }
            }}
            onFocus={() => companyQuery.trim() && setShowCompanyResults(true)}
            placeholder="Rechercher une entreprise..."
            className="w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 py-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all shadow-sm"
          />
          {(companyQuery || selectedCompanyId) && (
            <button
              type="button"
              onClick={handleCompanyClear}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
            >
              ✕
            </button>
          )}
        </div>

        {/* Dropdown résultats */}
        {showCompanyResults && companyQuery.trim() && !selectedCompanyId && (
          <div className="absolute z-50 mt-2 w-full rounded-xl border border-slate-200 bg-white shadow-xl max-h-96 overflow-auto">
            {isLoadingCompanies ? (
              <div className="p-4 text-center text-sm text-slate-500">Recherche en cours...</div>
            ) : companyResults.length > 0 ? (
              <div className="py-2">
                {companyResults.map((company: any) => (
                  <button
                    key={company.id}
                    type="button"
                    onClick={() => handleCompanySelect(company)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left border-b border-slate-100 last:border-b-0"
                  >
                    <div className="flex-shrink-0">
                      <BuildingOfficeIcon className="h-5 w-5 text-indigo-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-medium text-slate-900 truncate">{company.name}</p>
                        <span className="flex-shrink-0 text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                          Client
                        </span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="p-4 text-center text-sm text-slate-500">
                Aucune entreprise trouvée pour "{companyQuery}"
              </div>
            )}
          </div>
        )}
      </div>

      {/* Ventes effectives (global ou filtré par entreprise) */}
      <EffectiveSalesSection companyId={selectedCompanyId} />

      {view === 'kanban' && (
        <div className="flex gap-3 sm:gap-4 overflow-x-auto pb-2">
          {Object.entries(STAGES).map(([stageKey, { label }]) => {
            const stage = stageKey as keyof typeof STAGES;
            const count = opportunitiesByStage[stageKey]?.length || 0;
            const ca = totalByStage[stageKey] || 0;

            // Trello: auto-repli si vide + override manuel persistant
            const autoCollapsed = count === 0;
            const override = collapsedStageOverrides[stage];
            const collapsed = override ?? autoCollapsed;

            return (
              <div
                key={stageKey}
                className={`flex flex-col rounded-lg border-2 border-t-[3px] ${draggedOpp ? 'border-dashed border-indigo-300' : 'border-slate-200'} bg-slate-50 transition-all ${
                  collapsed ? 'w-16 min-w-16' : 'w-[320px] min-w-[320px]'
                }`}
                style={{
                  borderTopColor: STAGES[stage as OpportunityStageId].chartColor
                }}
                onDragOver={handleDragOver}
                onDrop={() => handleDrop(stage)}
              >
                <div className={`border-b border-slate-200 bg-white ${collapsed ? 'px-2 py-2' : 'px-3 sm:px-4 py-2 sm:py-3'}`}>
                  {!collapsed ? (
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900">{label}</h3>
                        <p className="text-xs text-slate-500">{count} opportunité(s)</p>
                        <div className="mt-1 space-y-0.5 sm:space-y-1">
                          <p className="text-xs sm:text-sm font-semibold text-slate-700">
                            CA: {ca.toFixed(0)} €
                          </p>
                          <p className="text-xs sm:text-sm font-semibold text-emerald-600">
                            Net: {(ca * 0.73).toFixed(0)} €
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setCollapsedStageOverrides((prev) => ({ ...prev, [stage]: true }));
                        }}
                        className="rounded-md border border-slate-200 bg-white p-1 text-slate-600 hover:bg-slate-50"
                        title="Replier"
                      >
                        <ChevronLeftIcon className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-1 flex-col items-center justify-between py-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setCollapsedStageOverrides((prev) => ({ ...prev, [stage]: false }));
                        }}
                        className="rounded-md border border-slate-200 bg-white p-1 text-slate-600 hover:bg-slate-50"
                        title="Déplier"
                      >
                        <ChevronRightIcon className="h-4 w-4" />
                      </button>
                      <div className="mt-2 text-xs font-semibold text-slate-700">{count}</div>
                      <div className="mt-2 text-xs font-semibold text-slate-700 [writing-mode:vertical-rl] rotate-180 whitespace-nowrap">
                        {label}
                      </div>
                      <div className="h-2" />
                    </div>
                  )}
                </div>

                {!collapsed && (
                  <div className="flex-1 space-y-2 p-2 sm:p-3">
                    {(() => {
                      const stageOpps = opportunitiesByStage[stageKey] || [];
                      // Grouper par client, en préservant l'ordre croissant de closeDate
                      const groupMap = new Map<string, { companyName: string; companyId?: string; opps: Opportunity[] }>();
                      for (const opp of stageOpps) {
                        const key = opp.company?.id || (opp as any).companyId || '__none__';
                        const name = opp.company?.name ?? 'Sans client';
                        if (!groupMap.has(key)) groupMap.set(key, { companyName: name, companyId: opp.company?.id, opps: [] });
                        groupMap.get(key)!.opps.push(opp);
                      }
                      // Trier les groupes par la date la plus proche de leur première opportunité
                      const groups = Array.from(groupMap.values()).sort((a, b) => {
                        const da = a.opps[0]?.closeDate;
                        const db = b.opps[0]?.closeDate;
                        if (!da && !db) return 0;
                        if (!da) return 1;
                        if (!db) return -1;
                        return new Date(da).getTime() - new Date(db).getTime();
                      });

                      return groups.map(({ companyName, companyId, opps: groupOpps }) => (
                        <div key={companyId || companyName} className="space-y-1.5">
                          {/* En-tête client */}
                          <div
                            className="flex items-center gap-1.5 px-1 pt-1 cursor-pointer group"
                            onClick={() => companyId && (window.location.href = `/entreprises/${companyId}`)}
                          >
                            <BuildingOfficeIcon className="h-3 w-3 text-slate-400 shrink-0" />
                            <span className={`text-xs font-semibold truncate ${companyId ? 'text-slate-600 group-hover:text-indigo-600' : 'text-slate-400'}`}>
                              {companyName}
                            </span>
                            <span className="ml-auto text-xs text-slate-400 shrink-0">
                              {groupOpps.length > 1 ? `${groupOpps.length}` : ''}
                            </span>
                          </div>
                          {/* Cartes d'opportunités */}
                          {groupOpps.map((opp) => {
                            const oppPayments = payments.filter(p => p.opportunityId === opp.id);
                            const hasPayment = oppPayments.length > 0;
                            const totalPaid = oppPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
                            const totalAmount = Number(opp.amount || 0);
                            const remaining = totalAmount - totalPaid;
                            const fullyPaid = hasPayment && remaining <= 0;
                            return (
                              <div
                                key={opp.id}
                                draggable
                                onDragStart={() => handleDragStart(opp)}
                                className={`w-full rounded-lg border border-slate-200 bg-white p-2 sm:p-3 shadow-sm hover:shadow-md transition-all text-left ${draggedOpp?.id === opp.id ? 'opacity-50' : ''}`}
                              >
                                <div
                                  onClick={() => window.location.href = `/opportunites/${opp.id}`}
                                  className="cursor-pointer"
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <h4 className="font-medium text-slate-900 text-xs sm:text-sm line-clamp-2">{opp.title}</h4>
                                    {totalAmount > 0 && (
                                      <div className="text-right shrink-0">
                                        {hasPayment && !fullyPaid ? (
                                          <>
                                            <div className="text-xs sm:text-sm font-semibold text-amber-600 whitespace-nowrap">
                                              {remaining.toFixed(0)} € restant
                                            </div>
                                            <div className="text-xs text-slate-400 whitespace-nowrap">
                                              / {totalAmount.toFixed(0)} €
                                            </div>
                                          </>
                                        ) : (
                                          <div className={`text-xs sm:text-sm font-semibold whitespace-nowrap ${fullyPaid ? 'text-green-600' : 'text-indigo-600'}`}>
                                            {totalAmount.toFixed(0)} €
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>

                                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                                    {opp.closeDate && (
                                      <span className="whitespace-nowrap">
                                        📅 {new Date(opp.closeDate).toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' })}
                                      </span>
                                    )}
                                    {opp.expectedPaymentDate && (
                                      <span className="whitespace-nowrap">
                                        💰 {new Date(opp.expectedPaymentDate).toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' })}
                                      </span>
                                    )}
                                    {fullyPaid && (
                                      <span className="whitespace-nowrap text-green-600 font-semibold">
                                        ✅ Soldé
                                      </span>
                                    )}
                                    {hasPayment && !fullyPaid && (
                                      <span className="whitespace-nowrap text-amber-600 font-semibold">
                                        ⏳ Partiel
                                      </span>
                                    )}
                                  </div>

                                  {opp.contact && (
                                    <div className="mt-1 text-xs text-slate-400 truncate">
                                      {opp.contact.firstName} {opp.contact.lastName ?? ''}
                                    </div>
                                  )}
                                </div>
                                <div className="mt-2 pt-2 border-t border-slate-100">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleMarkAsPaid(opp);
                                    }}
                                    className="w-full flex items-center justify-center gap-1 px-2 py-1 text-xs bg-indigo-50 text-indigo-700 rounded hover:bg-indigo-100"
                                  >
                                    <CurrencyEuroIcon className="h-3 w-3" />
                                    {hasPayment ? 'Ajouter paiement' : 'Marquer comme payé'}
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ));
                    })()}
                    {count === 0 && (
                      <div className="rounded-lg border border-dashed border-slate-200 bg-white/60 p-4 text-center text-xs text-slate-500">
                        Colonne vide
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {view === 'list' && (
        <div className="space-y-3 sm:space-y-0">
          {/* Vue mobile : cartes */}
          <div className="sm:hidden space-y-3">
            {opportunities.map((opportunity) => {
              const hasPayment = payments.some(p => p.opportunityId === opportunity.id);
              return (
                <div
                  key={opportunity.id}
                  className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md transition-all"
                >
                  <div 
                    onClick={() => window.location.href = `/opportunites/${opportunity.id}`}
                    className="cursor-pointer"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-medium text-slate-900 text-sm flex-1">{opportunity.title}</h3>
                      <span className={`ml-2 rounded-full px-2 py-1 text-xs font-medium ${STAGES[opportunity.stage].badgeClass}`}>
                        {STAGES[opportunity.stage].label}
                      </span>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-indigo-600">
                        {opportunity.amount !== undefined && opportunity.amount !== null 
                          ? `${Number(opportunity.amount).toFixed(0)} €` 
                          : 'Montant non défini'}
                      </p>
                      {opportunity.closeDate && (
                        <p className="text-xs text-slate-400">
                          📅 {new Date(opportunity.closeDate).toLocaleDateString('fr-FR')}
                        </p>
                      )}
                      {opportunity.expectedPaymentDate && (
                        <p className="text-xs text-slate-400">
                          💰 Prévisionnel: {new Date(opportunity.expectedPaymentDate).toLocaleDateString('fr-FR')}
                        </p>
                      )}
                      {hasPayment && (
                        <p className="text-xs text-green-600 font-semibold">
                          ✅ Payé
                        </p>
                      )}
                      <p className="text-xs text-slate-500">
                        {opportunity.contact
                          ? `${opportunity.contact.firstName} ${opportunity.contact.lastName ?? ''}`
                          : opportunity.company?.name ?? '-'}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-slate-100">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMarkAsPaid(opportunity);
                      }}
                      className="w-full flex items-center justify-center gap-1 px-3 py-2 text-xs bg-indigo-50 text-indigo-700 rounded hover:bg-indigo-100"
                    >
                      <CurrencyEuroIcon className="h-4 w-4" />
                      {hasPayment ? 'Ajouter un paiement' : 'Marquer comme payé'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Vue desktop : tableau */}
          <div className="hidden sm:block overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100">
                <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Titre</th>
                    <th className="px-4 py-3">Étape</th>
                    <th className="px-4 py-3">Montant</th>
                    <th className="px-4 py-3">Contact</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {opportunities.map((opportunity) => {
                    const hasPayment = payments.some(p => p.opportunityId === opportunity.id);
                    return (
                      <tr 
                        key={opportunity.id} 
                        className="text-sm text-slate-700 hover:bg-slate-50"
                      >
                        <td 
                          onClick={() => window.location.href = `/opportunites/${opportunity.id}`}
                          className="px-4 py-3 font-medium text-slate-900 cursor-pointer"
                        >
                          {opportunity.title}
                        </td>
                        <td 
                          onClick={() => window.location.href = `/opportunites/${opportunity.id}`}
                          className="px-4 py-3 cursor-pointer"
                        >
                          <span className={`rounded-full px-2 py-1 text-xs font-medium ${STAGES[opportunity.stage].badgeClass}`}>
                            {STAGES[opportunity.stage].label}
                          </span>
                        </td>
                        <td 
                          onClick={() => window.location.href = `/opportunites/${opportunity.id}`}
                          className="px-4 py-3 cursor-pointer"
                        >
                          <div>
                            {opportunity.amount !== undefined && opportunity.amount !== null 
                              ? `${Number(opportunity.amount).toFixed(2)} €` 
                              : '-'}
                          </div>
                          {opportunity.closeDate && (
                            <div className="text-xs text-slate-400 mt-1">
                              📅 {new Date(opportunity.closeDate).toLocaleDateString('fr-FR')}
                            </div>
                          )}
                          {opportunity.expectedPaymentDate && (
                            <div className="text-xs text-slate-400 mt-1">
                              💰 {new Date(opportunity.expectedPaymentDate).toLocaleDateString('fr-FR')}
                            </div>
                          )}
                          {hasPayment && (
                            <div className="text-xs text-green-600 mt-1 font-semibold">
                              ✅ Payé
                            </div>
                          )}
                        </td>
                        <td 
                          onClick={() => window.location.href = `/opportunites/${opportunity.id}`}
                          className="px-4 py-3 cursor-pointer"
                        >
                          {opportunity.contact
                            ? `${opportunity.contact.firstName} ${opportunity.contact.lastName ?? ''}`
                            : opportunity.company?.name ?? '-'}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMarkAsPaid(opportunity);
                            }}
                            className="flex items-center gap-1 px-2 py-1 text-xs bg-indigo-50 text-indigo-700 rounded hover:bg-indigo-100"
                          >
                            <CurrencyEuroIcon className="h-3 w-3" />
                            {hasPayment ? 'Ajouter' : 'Payer'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}


      {showModal && <CreateOpportunityModal onClose={() => setShowModal(false)} onCreated={loadOpportunities} />}
      
      {selectedOpportunity && (
        <MultiplePaymentsModal
          isOpen={showPaymentModal}
          onClose={() => {
            setShowPaymentModal(false);
            setSelectedOpportunity(null);
          }}
          opportunityId={selectedOpportunity.id}
          opportunityTitle={selectedOpportunity.title}
          opportunityAmount={selectedOpportunity.amount}
          opportunityTaxRate={selectedOpportunity.taxRate}
          onSuccess={handlePaymentSuccess}
        />
      )}
    </div>
  );
}

function CreateOpportunityModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState('');
  const [stage, setStage] = useState<keyof typeof STAGES>('QUALIFICATION');
  const [amount, setAmount] = useState('');
  const [closeDate, setCloseDate] = useState('');
  const [expectedPaymentDate, setExpectedPaymentDate] = useState('');
  const [contacts, setContacts] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [selectedContact, setSelectedContact] = useState<string | undefined>();
  const [selectedCompany, setSelectedCompany] = useState<string | undefined>();

  useEffect(() => {
    void loadContacts();
    void loadCompanies();
  }, []);

  const loadContacts = async () => {
    const { data } = await api.get('/api/contacts');
    setContacts(data.items || data.data || []);
  };

  const loadCompanies = async () => {
    const { data } = await api.get('/api/companies');
    setCompanies(Array.isArray(data) ? data : (data.items || data.data || []));
  };

  // Filtrer les contacts par client sélectionné
  const filteredContacts = selectedCompany 
    ? contacts.filter(c => c.companyId === selectedCompany)
    : contacts;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedCompany) {
      alert('Veuillez sélectionner une entreprise');
      return;
    }

    try {
      const { data: newOpportunity } = await api.post('/api/opportunities', {
        title,
        stage,
        amount: amount ? parseFloat(amount) : undefined,
        closeDate: closeDate || undefined,
        expectedPaymentDate: expectedPaymentDate || undefined,
        contactId: selectedContact,
        companyId: selectedCompany
      });
      onCreated();
      onClose();
      // Naviguer vers la page de détail de l'opportunité créée pour voir le lien Drive
      if (newOpportunity?.id) {
        window.location.href = `/opportunites/${newOpportunity.id}`;
      }
    } catch (error) {
      console.error('Erreur création opportunité:', error);
      alert('Erreur lors de la création');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-semibold mb-4">Nouvelle opportunité</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* CLIENT EN PRIORITÉ */}
          <div className="rounded-lg bg-indigo-50 p-4 border border-indigo-200">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              🏢 Client *
              <span className="text-xs text-slate-500 ml-2">(À renseigner en premier)</span>
            </label>
            <CompanySearchSelect
              companies={companies}
              selectedCompanyId={selectedCompany}
              onSelectCompany={(companyId) => {
                setSelectedCompany(companyId);
                // Réinitialiser le contact si le client change
                if (selectedContact) {
                  const contact = contacts.find(c => c.id === selectedContact);
                  if (contact && contact.companyId !== companyId) {
                    setSelectedContact(undefined);
                  }
                }
              }}
              onCreateCompany={async (name) => {
                const { data: newCompany } = await api.post('/api/companies', { name });
                setCompanies([...companies, newCompany]);
                setSelectedCompany(newCompany.id);
              }}
            />
          </div>

          {/* CONTACT (filtré par client) */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              👤 Contact
              {selectedCompany && filteredContacts.length > 0 && (
                <span className="text-xs text-slate-500 ml-2">
                  ({filteredContacts.length} contact(s) chez ce client)
                </span>
              )}
            </label>
            {selectedCompany ? (
              <ContactSearchSelect
                contacts={filteredContacts}
                selectedContactId={selectedContact}
                defaultCompanyId={selectedCompany}
                defaultCompanyName={companies.find(c => c.id === selectedCompany)?.name}
                onSelectContact={(contactId) => setSelectedContact(contactId)}
                onCreateContact={async (firstName, lastName, companyId) => {
                  const { data: newContact } = await api.post('/api/contacts', { 
                    firstName, 
                    lastName: lastName || undefined,
                    companyId: companyId || undefined
                  });
                  setContacts([...contacts, newContact]);
                  setSelectedContact(newContact.id);
                }}
              />
            ) : (
              <div className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-400">
                Sélectionnez d'abord un client
              </div>
            )}
          </div>

          <div className="border-t border-slate-200 pt-4">
            <label className="block text-sm font-medium text-slate-700 mb-1">Titre de l'opportunité *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Étape</label>
            <select
              value={stage}
              onChange={(e) => setStage(e.target.value as keyof typeof STAGES)}
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
            >
              {Object.entries(STAGES).map(([key, { label }]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Montant (€)</label>
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Date prévisionnelle de facturation</label>
            <input
              type="date"
              value={closeDate}
              onChange={(e) => setCloseDate(e.target.value)}
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Date paiement prévisionnelle</label>
            <input
              type="date"
              value={expectedPaymentDate}
              onChange={(e) => setExpectedPaymentDate(e.target.value)}
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-md border border-slate-200 px-4 py-2 text-sm hover:bg-slate-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="flex-1 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
            >
              Créer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

