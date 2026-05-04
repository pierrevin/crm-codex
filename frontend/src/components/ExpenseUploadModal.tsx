import { useState, useRef, useEffect, FormEvent } from 'react';
import { XMarkIcon, CameraIcon, PhotoIcon } from '@heroicons/react/24/outline';
import { expensesService, Expense, CreateExpenseDto, UpdateExpenseDto } from '../services/expensesService';
import { recurringExpensesService, RecurrenceType, CreateRecurringExpenseDto } from '../services/recurringExpensesService';
import { AccountCodeSelector } from './AccountCodeSelector';
import { SupplierSearchSelect } from './SupplierSearchSelect';
import { supplierPreferencesService } from '../services/supplierPreferences';
import api from '../services/apiClient';

interface ExpenseUploadModalProps {
  onClose: () => void;
  opportunityId?: string; // ID de l'opportunité optionnelle
}

export function ExpenseUploadModal({ onClose, opportunityId }: ExpenseUploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expenseId, setExpenseId] = useState<string | null>(null); // ID de la dépense créée après scan
  
  // États pour tous les champs
  const [expenseType, setExpenseType] = useState<'standard' | 'salary'>('standard');
  const [isRecurring, setIsRecurring] = useState<boolean>(false);
  const [supplierName, setSupplierName] = useState<string>('');
  const [invoiceNumber, setInvoiceNumber] = useState<string>('');
  const [invoiceDate, setInvoiceDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [amountHT, setAmountHT] = useState<string>('');
  const [amountTTC, setAmountTTC] = useState<string>('');
  const [vatRate, setVatRate] = useState<string>('20');
  const [vatAmount, setVatAmount] = useState<string>('');
  const [accountCode, setAccountCode] = useState<string>('');
  const [accountLabel, setAccountLabel] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [companies, setCompanies] = useState<any[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [opportunities, setOpportunities] = useState<any[]>([]);
  const [selectedOpportunityId, setSelectedOpportunityId] = useState<string>(opportunityId || '');
  const [saving, setSaving] = useState(false);
  
  // États pour la récurrence
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>('MONTHLY');
  const [paymentDay, setPaymentDay] = useState<string>('1');
  const [recurrenceStartDate, setRecurrenceStartDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [recurrenceEndDate, setRecurrenceEndDate] = useState<string>('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Charger les entreprises et opportunités
  useEffect(() => {
    void loadCompanies();
    void loadOpportunities();
  }, []);

  // Initialiser selectedOpportunityId si opportunityId est fourni
  useEffect(() => {
    if (opportunityId) {
      setSelectedOpportunityId(opportunityId);
    }
  }, [opportunityId]);

  // Mettre à jour le client automatiquement quand l'opportunité change
  useEffect(() => {
    if (selectedOpportunityId && opportunities.length > 0) {
      const selectedOpp = opportunities.find((opp: any) => opp.id === selectedOpportunityId);
      if (selectedOpp) {
        // Utiliser companyId directement ou depuis la relation company
        const companyId = selectedOpp.companyId || selectedOpp.company?.id;
        if (companyId) {
          setSelectedCompanyId(companyId);
        }
      }
    }
  }, [selectedOpportunityId, opportunities]);

  // Créer un nouveau fournisseur
  const handleCreateSupplier = async (name: string, companyData?: any) => {
    try {
      const dataToSend = { name, ...(companyData || { statusSupplier: true }) };
      const { data } = await api.post('/api/companies', dataToSend);
      return data;
    } catch (error) {
      console.error('Erreur création fournisseur:', error);
      throw error;
    }
  };

  // Charger les préférences du fournisseur sélectionné
  useEffect(() => {
    if (selectedSupplierId && expenseType === 'standard') {
      const prefs = supplierPreferencesService.get(selectedSupplierId);
      if (prefs) {
        if (prefs.vatRate !== undefined) {
          setVatRate((prefs.vatRate * 100).toFixed(2));
        }
        if (prefs.accountCode) {
          setAccountCode(prefs.accountCode);
        }
        if (prefs.accountLabel) {
          setAccountLabel(prefs.accountLabel);
        }
      }
    } else if (supplierName && !selectedSupplierId && expenseType === 'standard') {
      // Si pas d'ID mais un nom, essayer de charger par nom
      const prefs = supplierPreferencesService.getByName(supplierName);
      if (prefs) {
        if (prefs.vatRate !== undefined) {
          setVatRate((prefs.vatRate * 100).toFixed(2));
        }
        if (prefs.accountCode) {
          setAccountCode(prefs.accountCode);
        }
        if (prefs.accountLabel) {
          setAccountLabel(prefs.accountLabel);
        }
      }
    }
  }, [selectedSupplierId, supplierName, expenseType]);

  const loadCompanies = async () => {
    try {
      const { data: companiesData } = await api.get('/api/companies');
      const allCompanies = Array.isArray(companiesData) ? companiesData : (companiesData.items || companiesData.data || []);
      setCompanies(allCompanies);
    } catch (error) {
      console.error('Erreur chargement entreprises:', error);
    }
  };

  const loadOpportunities = async () => {
    try {
      // Charger les opportunités avec leurs relations company
      const { data } = await api.get('/api/opportunities?limit=1000');
      const opps = Array.isArray(data) ? data : (data.items || data.data || []);
      setOpportunities(opps);
      
      // Si une opportunité est déjà sélectionnée, mettre à jour le client
      if (selectedOpportunityId) {
        const selectedOpp = opps.find((opp: any) => opp.id === selectedOpportunityId);
        if (selectedOpp) {
          // Utiliser companyId directement ou depuis la relation company
          const companyId = selectedOpp.companyId || selectedOpp.company?.id;
          if (companyId) {
            setSelectedCompanyId(companyId);
          }
        }
      }
    } catch (error) {
      console.error('Erreur chargement opportunités:', error);
    }
  };

  // Gérer le changement de type de dépense
  useEffect(() => {
    if (expenseType === 'salary') {
      // Pour les salaires : pas de TVA, pas de client, pas d'opportunité
      setVatRate('0');
      setVatAmount('0');
      setSelectedCompanyId('');
      setSelectedOpportunityId('');
      setInvoiceNumber(''); // Supprimer le numéro de facture
      if (!supplierName) {
        setSupplierName('Pierre');
      }
      // Code compte pour salaires (6411 = Rémunérations du personnel)
      if (!accountCode) {
        setAccountCode('6411');
        setAccountLabel('Rémunérations du personnel');
      }
    }
  }, [expenseType]);

  // Calculer automatiquement les montants
  useEffect(() => {
    if (expenseType === 'salary') {
      // Pour les salaires, HT = TTC (pas de TVA)
      if (amountTTC) {
        setAmountHT(amountTTC);
        setVatAmount('0');
      } else if (amountHT) {
        setAmountTTC(amountHT);
        setVatAmount('0');
      }
    } else {
      // Pour les dépenses classiques, calcul normal
      if (amountHT && vatRate) {
        const ht = parseFloat(amountHT);
        const rate = parseFloat(vatRate) / 100;
        const ttc = ht * (1 + rate);
        setAmountTTC(ttc.toFixed(2));
        setVatAmount((ttc - ht).toFixed(2));
      } else if (amountTTC && vatRate) {
        const ttc = parseFloat(amountTTC);
        const rate = parseFloat(vatRate) / 100;
        const ht = ttc / (1 + rate);
        setAmountHT(ht.toFixed(2));
        setVatAmount((ttc - ht).toFixed(2));
      }
    }
  }, [amountHT, amountTTC, vatRate, expenseType]);

  // Nettoyer le stream quand on quitte
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    };
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    const validTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    if (!validTypes.includes(selectedFile.type)) {
      setError('Format de fichier non supporté. Utilisez JPG, PNG ou PDF.');
      return;
    }

    setFile(selectedFile);
    setError(null);

    if (selectedFile.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreview(e.target?.result as string);
      };
      reader.readAsDataURL(selectedFile);
    } else {
      setPreview(null);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(droppedFile);
      if (fileInputRef.current) {
        fileInputRef.current.files = dataTransfer.files;
        handleFileSelect({ target: { files: dataTransfer.files } } as any);
      }
    }
  };

  const startCamera = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError('Votre navigateur ne supporte pas l\'accès à la caméra.');
      return;
    }

    try {
      setScanning(true);
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment', // Caméra arrière sur mobile
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setCameraReady(false);
        videoRef.current.onloadedmetadata = () => {
            setCameraReady(true);
        };
      } else {
        throw new Error('Référence vidéo non disponible');
      }
    } catch (err: any) {
      console.error('Erreur accès caméra:', err);
      setScanning(false);
      setCameraReady(false);
      
      let errorMessage = 'Impossible d\'accéder à la caméra.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        errorMessage = 'Permission caméra refusée. Veuillez autoriser l\'accès à la caméra.';
      } else if (err.name === 'NotFoundError') {
        errorMessage = 'Aucune caméra trouvée.';
      }
      
      setError(errorMessage);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current.pause();
    }
    setScanning(false);
    setCameraReady(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) {
      setError('Impossible d\'accéder au contexte canvas.');
      return;
    }

    if (video.readyState < video.HAVE_METADATA) {
      setError('La vidéo n\'est pas encore prête.');
      return;
    }

    const videoWidth = video.videoWidth;
    const videoHeight = video.videoHeight;

    if (videoWidth === 0 || videoHeight === 0) {
      setError('Les dimensions de la vidéo ne sont pas valides.');
      return;
    }

    canvas.width = videoWidth;
    canvas.height = videoHeight;

    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    
    if (isMobile) {
      context.drawImage(video, 0, 0, videoWidth, videoHeight);
    } else {
      context.save();
      context.scale(-1, 1);
      context.drawImage(video, -videoWidth, 0, videoWidth, videoHeight);
      context.restore();
    }

    canvas.toBlob((blob) => {
      if (blob) {
        const capturedFile = new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' });
        setFile(capturedFile);
        setPreview(canvas.toDataURL('image/jpeg'));
        stopCamera();
      } else {
        setError('Erreur lors de la capture de la photo.');
      }
    }, 'image/jpeg', 0.92);
  };

  // Traiter le fichier si présent (scan OCR)
  const processFile = async () => {
    if (!file) return;

    setProcessing(true);
    setError(null);

    try {
      const expense = await expensesService.scanExpense(file, accountCode, selectedOpportunityId);
      setExpenseId(expense.id);
      
      // Pré-remplir les champs avec les données extraites
      if (expense.supplierName) setSupplierName(expense.supplierName);
      if (expense.invoiceNumber) setInvoiceNumber(expense.invoiceNumber);
      if (expense.invoiceDate) setInvoiceDate(expense.invoiceDate.split('T')[0]);
      if (expense.amountHT) setAmountHT(expense.amountHT.toString());
      if (expense.amountTTC) setAmountTTC(expense.amountTTC.toString());
      if (expense.vatRate) setVatRate((Number(expense.vatRate) * 100).toFixed(2));
      if (expense.vatAmount) setVatAmount(expense.vatAmount.toString());
      if (expense.accountCode) setAccountCode(expense.accountCode);
      if (expense.accountLabel) setAccountLabel(expense.accountLabel);
      if (expense.companyId) setSelectedCompanyId(expense.companyId);
      if (expense.opportunityId) setSelectedOpportunityId(expense.opportunityId);
    } catch (err: any) {
      console.error('Erreur scan:', err);
      const status = err.response?.status;
      const message = err.response?.data?.message || err.message;
      
      if (status === 500 && message?.includes('PERMISSION_DENIED')) {
        setError('Erreur de permissions Google Cloud. Vous pouvez remplir les informations manuellement.');
      } else {
        setError(message || 'Erreur lors du scan. Vous pouvez remplir les informations manuellement.');
      }
    } finally {
      setProcessing(false);
    }
  };

  // Traiter le fichier automatiquement quand il est sélectionné
  useEffect(() => {
    if (file && !expenseId) {
      void processFile();
    }
  }, [file]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      if (expenseId) {
        // Mettre à jour la dépense existante (créée par le scan)
        const updateData: UpdateExpenseDto = {
          supplierName: supplierName || undefined,
          invoiceNumber: invoiceNumber || undefined,
          invoiceDate: invoiceDate ? new Date(invoiceDate + 'T00:00:00').toISOString() : undefined,
          amountHT: amountHT ? parseFloat(amountHT) : undefined,
          amountTTC: amountTTC ? parseFloat(amountTTC) : undefined,
          vatAmount: expenseType === 'salary' ? 0 : (vatAmount ? parseFloat(vatAmount) : undefined),
          vatRate: expenseType === 'salary' ? 0 : (vatRate ? parseFloat(vatRate) / 100 : undefined),
          accountCode: accountCode || undefined,
          accountLabel: accountLabel || undefined,
          notes: notes || undefined,
          companyId: expenseType === 'salary' ? undefined : (selectedCompanyId || undefined),
          opportunityId: expenseType === 'salary' ? undefined : (selectedOpportunityId || undefined),
          status: 'PROCESSED'
        };

        await expensesService.update(expenseId, updateData);
        
        // Sauvegarder les préférences du fournisseur
        if (expenseType === 'standard' && supplierName) {
          const prefs: any = {};
          if (vatRate) {
            prefs.vatRate = parseFloat(vatRate) / 100;
          }
          if (accountCode) {
            prefs.accountCode = accountCode;
          }
          if (accountLabel) {
            prefs.accountLabel = accountLabel;
          }
          
          if (selectedSupplierId) {
            supplierPreferencesService.save(selectedSupplierId, prefs);
          } else if (supplierName) {
            supplierPreferencesService.saveByName(supplierName, prefs);
          }
        }
      } else {
        // Si c'est une dépense récurrente, créer un modèle récurrent
        if (isRecurring) {
          const recurringDto: CreateRecurringExpenseDto = {
            supplierName: supplierName || undefined,
            amountHT: amountHT ? parseFloat(amountHT) : undefined,
            amountTTC: amountTTC ? parseFloat(amountTTC) : undefined,
            vatRate: expenseType === 'salary' ? 0 : (vatRate ? parseFloat(vatRate) / 100 : undefined),
            vatAmount: expenseType === 'salary' ? 0 : (vatAmount ? parseFloat(vatAmount) : undefined),
            accountCode: accountCode || undefined,
            accountLabel: accountLabel || undefined,
            recurrenceType,
            paymentDay: parseInt(paymentDay, 10),
            startDate: recurrenceStartDate ? new Date(recurrenceStartDate + 'T00:00:00').toISOString() : new Date().toISOString(),
            endDate: recurrenceEndDate ? new Date(recurrenceEndDate + 'T00:00:00').toISOString() : undefined,
            isActive: true,
            notes: notes || undefined,
            companyId: expenseType === 'salary' ? undefined : (selectedCompanyId || undefined),
            opportunityId: expenseType === 'salary' ? undefined : (selectedOpportunityId || undefined),
          };

          const recurringExpense = await recurringExpensesService.create(recurringDto);
          
          // Générer les dépenses prévisionnelles pour les 12 prochains mois
          const startDate = new Date(recurrenceStartDate);
          const endDate = new Date(startDate);
          endDate.setMonth(endDate.getMonth() + 12);
          
          console.log('[ExpenseUploadModal] Generating forecast expenses for recurring expense:', recurringExpense.id)
          const generatedExpenses = await recurringExpensesService.generateForecast(
            recurringExpense.id,
            startDate.toISOString(),
            endDate.toISOString()
          );
          console.log('[ExpenseUploadModal] Generated', generatedExpenses?.length || 0, 'forecast expenses')
        } else {
          // Créer une nouvelle dépense sans fichier
          const dto: CreateExpenseDto = {
            supplierName: supplierName || undefined,
            invoiceDate: invoiceDate ? new Date(invoiceDate + 'T00:00:00').toISOString() : undefined,
            amountHT: amountHT ? parseFloat(amountHT) : undefined,
            amountTTC: amountTTC ? parseFloat(amountTTC) : undefined,
            vatRate: expenseType === 'salary' ? 0 : (vatRate ? parseFloat(vatRate) / 100 : undefined),
            vatAmount: expenseType === 'salary' ? 0 : (vatAmount ? parseFloat(vatAmount) : undefined),
            accountCode: accountCode || undefined,
            notes: notes || undefined,
            companyId: expenseType === 'salary' ? undefined : (selectedCompanyId || undefined),
            opportunityId: expenseType === 'salary' ? undefined : (selectedOpportunityId || undefined),
            status: 'VERIFIED'
          };

          await expensesService.create(dto);
        }
      }

      // Sauvegarder les préférences du fournisseur
      if (expenseType === 'standard' && supplierName) {
        const prefs: any = {};
        if (vatRate) {
          prefs.vatRate = parseFloat(vatRate) / 100;
        }
        if (accountCode) {
          prefs.accountCode = accountCode;
        }
        if (accountLabel) {
          prefs.accountLabel = accountLabel;
        }
        
        if (selectedSupplierId) {
          supplierPreferencesService.save(selectedSupplierId, prefs);
        } else if (supplierName) {
          supplierPreferencesService.saveByName(supplierName, prefs);
        }
      }

    onClose();
    window.location.reload();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-slate-200 sticky top-0 bg-white z-10">
          <h2 className="text-xl font-semibold text-slate-900">Nouvelle dépense</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Colonne gauche : Fichier (optionnel) */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-slate-900">Fichier (optionnel)</h3>
              
              {/* Zone d'upload */}
              {!file && !scanning && (
              <div
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <PhotoIcon className="w-12 h-12 mx-auto mb-4 text-slate-400" />
                <p className="text-slate-600 mb-2">
                  Glissez-déposez un fichier ici ou cliquez pour sélectionner
                </p>
                  <p className="text-sm text-slate-400 mb-4">
                  Formats supportés: JPG, PNG, PDF
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/jpg,application/pdf"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void startCamera();
                    }}
                    className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <CameraIcon className="w-5 h-5" />
                    Scanner avec la caméra
                  </button>
                </div>
              )}

              {/* Scanner caméra */}
              {scanning && (
                <div className="space-y-4">
                  <div className="relative bg-black rounded-lg overflow-hidden flex items-center justify-center" style={{ 
                    width: '100%',
                    aspectRatio: '2/3',
                    maxWidth: '400px',
                    margin: '0 auto',
                    minHeight: '300px'
                  }}>
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full"
                      style={{
                        transform: /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ? 'none' : 'scaleX(-1)',
                        objectFit: 'contain'
                      }}
                    />
                    <canvas ref={canvasRef} className="hidden" />
                    
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                      <div className="border-2 border-white/80 rounded-lg shadow-lg" style={{
                        width: '85%',
                        aspectRatio: '2/3',
                        boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)'
                      }} />
                    </div>
                    
                    {!cameraReady && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/70 z-10">
                        <div className="text-center">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
                          <div className="text-white text-sm">Chargement de la caméra...</div>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={capturePhoto}
                      disabled={!cameraReady}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      <CameraIcon className="w-5 h-5" />
                      Capturer
                    </button>
                    <button
                      type="button"
                      onClick={stopCamera}
                      className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300"
                    >
                      Annuler
                    </button>
                  </div>
                </div>
              )}

              {/* Aperçu du fichier */}
              {preview && !scanning && (
                <div className="space-y-2">
                  <div className="border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
                    {file?.type.startsWith('image/') ? (
                  <img
                    src={preview}
                        alt="Preview"
                        className="w-full h-auto max-h-64 object-contain"
                      />
                    ) : (
                      <div className="p-8 text-center text-slate-500">
                        <p>Fichier PDF sélectionné</p>
                        <p className="text-sm mt-1">{file?.name}</p>
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setFile(null);
                      setPreview(null);
                      setExpenseId(null);
                    }}
                    className="w-full px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 text-sm"
                  >
                    Supprimer le fichier
                  </button>
                </div>
              )}

              {/* Indicateur de traitement */}
              {processing && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center gap-2 text-blue-700">
                    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="text-sm">Extraction des données (OCR)...</span>
                  </div>
                </div>
              )}
            </div>

            {/* Colonne droite : Formulaire */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-slate-900">Informations</h3>

          {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Type de dépense *
                </label>
                <select
                  value={expenseType}
                  onChange={(e) => setExpenseType(e.target.value as 'standard' | 'salary')}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="standard">Dépense classique</option>
                  <option value="salary">Salaire</option>
                </select>
              </div>

              {expenseType === 'standard' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Fournisseur *
                  </label>
                  <SupplierSearchSelect
                    selectedSupplierId={selectedSupplierId}
                    onSelectSupplier={(supplierId, supplierName) => {
                      setSelectedSupplierId(supplierId || '');
                      setSupplierName(supplierName || '');
                    }}
                    onCreateSupplier={handleCreateSupplier}
                  />
                </div>
              )}

              {expenseType === 'salary' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Personnel *
                  </label>
                  <input
                    type="text"
                    value={supplierName}
                    onChange={(e) => setSupplierName(e.target.value)}
                    required
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              )}

              {expenseType === 'standard' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      N° Facture
                    </label>
                    <input
                      type="text"
                      value={invoiceNumber}
                      onChange={(e) => setInvoiceNumber(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Date facture *
                    </label>
                    <input
                      type="date"
                      value={invoiceDate}
                      onChange={(e) => setInvoiceDate(e.target.value)}
                      required
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>
                </div>
              )}

              {expenseType === 'salary' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Date versement *
                  </label>
                  <input
                    type="date"
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                    required
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              )}

              {expenseType === 'standard' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Montant HT (€)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={amountHT}
                        onChange={(e) => setAmountHT(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Taux TVA (%)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={vatRate}
                        onChange={(e) => setVatRate(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        TVA (€)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={vatAmount}
                        onChange={(e) => setVatAmount(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Montant TTC (€) *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={amountTTC}
                        onChange={(e) => setAmountTTC(e.target.value)}
                        required
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      />
                    </div>
                  </div>
                  </>
                )}

              {expenseType === 'salary' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Montant (€) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={amountTTC}
                    onChange={(e) => {
                      setAmountTTC(e.target.value);
                      setAmountHT(e.target.value);
                    }}
                    required
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    Les salaires ne sont pas soumis à la TVA
                  </p>
                </div>
              )}

              {expenseType === 'standard' && (
                <div>
                  <AccountCodeSelector
                    value={accountCode}
                    onChange={(code, label) => {
                      setAccountCode(code);
                      setAccountLabel(label);
                    }}
                    label="Code compte"
                    required
                  />
                </div>
              )}

              {expenseType === 'salary' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Code compte *
                  </label>
                  <input
                    type="text"
                    value={accountCode}
                    onChange={(e) => setAccountCode(e.target.value)}
                    required
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-slate-50"
                    placeholder="6411"
                    readOnly
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    Rémunérations du personnel (6411)
                  </p>
                </div>
              )}

              {expenseType === 'standard' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Opportunité (optionnel)
                    </label>
                    <select
                      value={selectedOpportunityId}
                      onChange={(e) => setSelectedOpportunityId(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    >
                      <option value="">Aucune (dépense indépendante)</option>
                      {opportunities.map(opp => {
                        const companyName = opp.company?.name || '';
                        const displayText = companyName 
                          ? `${opp.title} - ${companyName}`
                          : opp.title;
                        return (
                          <option key={opp.id} value={opp.id}>{displayText}</option>
                        );
                      })}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Client {selectedOpportunityId && '(rempli automatiquement)'}
                    </label>
                    <select
                      value={selectedCompanyId}
                      onChange={(e) => setSelectedCompanyId(e.target.value)}
                      disabled={!!selectedOpportunityId}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:bg-slate-50 disabled:text-slate-500"
                    >
                      <option value="">Aucun</option>
                      {companies.map(company => (
                        <option key={company.id} value={company.id}>{company.name}</option>
                      ))}
                    </select>
                    {selectedOpportunityId && (
                      <p className="mt-1 text-xs text-slate-500">
                        Le client est automatiquement rempli depuis l'opportunité sélectionnée
                      </p>
                    )}
                  </div>
                  </>
                )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Notes (optionnel)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  placeholder="Ajoutez des notes si nécessaire..."
                />
              </div>

              {/* Option dépense récurrente */}
              <div className="pt-4 border-t border-slate-200">
                <div className="flex items-center mb-4">
                  <input
                    type="checkbox"
                    id="isRecurring"
                    checked={isRecurring}
                    onChange={(e) => setIsRecurring(e.target.checked)}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-slate-300 rounded"
                  />
                  <label htmlFor="isRecurring" className="ml-2 block text-sm font-medium text-slate-700">
                    Dépense récurrente (salaire, loyer, etc.)
                  </label>
                </div>

                {isRecurring && (
                  <div className="space-y-4 bg-slate-50 p-4 rounded-lg">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          Type de récurrence *
                        </label>
                        <select
                          value={recurrenceType}
                          onChange={(e) => setRecurrenceType(e.target.value as RecurrenceType)}
                          required={isRecurring}
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        >
                          <option value="WEEKLY">Hebdomadaire</option>
                          <option value="MONTHLY">Mensuelle</option>
                          <option value="QUARTERLY">Trimestrielle</option>
                          <option value="YEARLY">Annuelle</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          Jour de paiement (1-31) *
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="31"
                          value={paymentDay}
                          onChange={(e) => setPaymentDay(e.target.value)}
                          required={isRecurring}
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          Date de début *
                        </label>
                        <input
                          type="date"
                          value={recurrenceStartDate}
                          onChange={(e) => setRecurrenceStartDate(e.target.value)}
                          required={isRecurring}
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          Date de fin (optionnel)
                        </label>
                        <input
                          type="date"
                          value={recurrenceEndDate}
                          onChange={(e) => setRecurrenceEndDate(e.target.value)}
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        />
                      </div>
                    </div>

                    <p className="text-xs text-slate-500">
                      Les dépenses prévisionnelles seront générées automatiquement chaque mois à partir de la date de début.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="mt-6 flex justify-end gap-3 pt-6 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
              disabled={saving || processing}
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving || processing || !supplierName || !amountTTC || (!isRecurring && !invoiceDate) || (isRecurring && (!recurrenceStartDate || !paymentDay))}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? 'Enregistrement...' : processing ? 'Traitement...' : isRecurring ? 'Créer la dépense récurrente' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
