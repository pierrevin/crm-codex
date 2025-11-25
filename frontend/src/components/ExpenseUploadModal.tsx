import { useState, useRef, useEffect } from 'react';
import { XMarkIcon, CameraIcon, PhotoIcon } from '@heroicons/react/24/outline';
import { expensesService, Expense } from '../services/expensesService';
import { ExpenseValidationModal } from './ExpenseValidationModal';

interface ExpenseUploadModalProps {
  onClose: () => void;
}

export function ExpenseUploadModal({ onClose }: ExpenseUploadModalProps) {
  const [activeTab, setActiveTab] = useState<'upload' | 'scan'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<'uploading' | 'processing' | 'extracting' | 'complete'>('uploading');
  const [error, setError] = useState<string | null>(null);
  const [scannedExpense, setScannedExpense] = useState<Expense | null>(null);
  const [showValidation, setShowValidation] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    // Nettoyer le stream quand on quitte
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Vérifier le type de fichier
    const validTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    if (!validTypes.includes(selectedFile.type)) {
      setError('Format de fichier non supporté. Utilisez JPG, PNG ou PDF.');
      return;
    }

    setFile(selectedFile);
    setError(null);

    // Créer une prévisualisation pour les images
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
    try {
      // Détecter si on est sur mobile
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      
      // Contraintes simples d'abord, on laisse le navigateur choisir le meilleur format
      const baseConstraints: MediaTrackConstraints = isMobile
        ? { facingMode: 'environment' } // Caméra arrière sur mobile
        : { facingMode: 'user' }; // Webcam sur desktop

      let stream: MediaStream;
      
      try {
        // Essayer avec contraintes de base d'abord
        stream = await navigator.mediaDevices.getUserMedia({
          video: baseConstraints,
          audio: false
        });
      } catch (err: any) {
        // Si échec, essayer sans contraintes
        console.warn('Tentative avec contraintes simples échouée, essai sans contraintes:', err);
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false
        });
      }
      
      streamRef.current = stream;
      
      if (videoRef.current) {
        const video = videoRef.current;
        video.srcObject = stream;
        
        // Forcer l'affichage
        video.setAttribute('playsinline', 'true');
        video.setAttribute('webkit-playsinline', 'true');
        
        // Attendre que la vidéo soit chargée et la jouer
        return new Promise<void>((resolve, reject) => {
          const onCanPlay = () => {
            video.removeEventListener('canplay', onCanPlay);
            video.removeEventListener('loadedmetadata', onLoadedMetadata);
            
            video.play()
              .then(() => {
                console.log('Vidéo démarrée. Dimensions:', video.videoWidth, 'x', video.videoHeight);
                setScanning(true);
                setError(null);
                resolve();
              })
              .catch((playErr) => {
                console.error('Erreur play:', playErr);
                // Essayer quand même de continuer
                setScanning(true);
                setError(null);
                resolve();
              });
          };
          
          const onLoadedMetadata = () => {
            console.log('Métadonnées chargées. Dimensions:', video.videoWidth, 'x', video.videoHeight);
            // Essayer de jouer dès que les métadonnées sont chargées
            if (video.readyState >= 2) {
              video.play().catch(() => {
                // Attendre canplay si play échoue
                video.addEventListener('canplay', onCanPlay, { once: true });
              });
            }
          };
          
          video.addEventListener('loadedmetadata', onLoadedMetadata, { once: true });
          video.addEventListener('canplay', onCanPlay, { once: true });
          
          // Timeout de sécurité
          setTimeout(() => {
            if (video.readyState >= 2) {
              video.play()
                .then(() => {
                  setScanning(true);
                  setError(null);
                  resolve();
                })
                .catch(() => {
                  setScanning(true);
                  setError(null);
                  resolve(); // Continuer même si play échoue
                });
            } else {
              reject(new Error('Timeout chargement vidéo'));
            }
          }, 3000);
        });
      }
    } catch (err: any) {
      console.error('Erreur accès caméra:', err);
      let errorMessage = 'Impossible d\'accéder à la caméra.';
      
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        errorMessage = 'Permission caméra refusée. Veuillez autoriser l\'accès à la caméra dans les paramètres de votre navigateur.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        errorMessage = 'Aucune caméra trouvée. Vérifiez que votre appareil dispose d\'une caméra.';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        errorMessage = 'La caméra est déjà utilisée par une autre application.';
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
    }
    setScanning(false);
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

    // S'assurer que la vidéo est prête
    if (video.readyState < video.HAVE_METADATA) {
      setError('La vidéo n\'est pas encore prête. Veuillez attendre quelques instants.');
      return;
    }

    // Utiliser les dimensions réelles de la vidéo
    const videoWidth = video.videoWidth;
    const videoHeight = video.videoHeight;

    if (videoWidth === 0 || videoHeight === 0) {
      setError('Les dimensions de la vidéo ne sont pas valides.');
      return;
    }

    // Toujours utiliser les dimensions réelles de la vidéo
    // Le format portrait sera préservé si la caméra est en portrait
    canvas.width = videoWidth;
    canvas.height = videoHeight;

    // Dessiner l'image sur le canvas (inverser le miroir horizontal)
    context.save();
    context.scale(-1, 1); // Inverser horizontalement
    context.drawImage(video, -videoWidth, 0, videoWidth, videoHeight);
    context.restore();

    // Convertir en blob
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

  const handleSubmit = async () => {
    if (!file) {
      setError('Veuillez sélectionner un fichier ou prendre une photo');
      return;
    }

    setUploading(true);
    setUploadProgress('uploading');
    setError(null);

    try {
      // Simuler les étapes pour l'UI
      setUploadProgress('uploading');
      await new Promise(resolve => setTimeout(resolve, 500));
      
      setUploadProgress('processing');
      await new Promise(resolve => setTimeout(resolve, 500));
      
      setUploadProgress('extracting');
      const expense = await expensesService.scanExpense(file);
      
      setUploadProgress('complete');
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Afficher le modal de validation au lieu de fermer directement
      setScannedExpense(expense);
      setShowValidation(true);
      setUploading(false);
      setUploadProgress('uploading');
    } catch (err: any) {
      console.error('Erreur upload:', err);
      const status = err.response?.status;
      const message = err.response?.data?.message || err.message;
      
      if (status === 401) {
        setError('Vous devez être connecté pour uploader une facture. Veuillez vous reconnecter.');
      } else if (status === 404) {
        setError('Endpoint non trouvé. Vérifiez que le backend est bien démarré.');
      } else if (status === 413) {
        setError('Fichier trop volumineux. Taille maximale : 10MB.');
      } else if (status === 500 && message?.includes('PERMISSION_DENIED')) {
        setError('Erreur de permissions Google Cloud. La dépense a été créée mais l\'OCR n\'a pas fonctionné. Vous pouvez remplir les informations manuellement.');
        // Fermer le modal même en cas d'erreur OCR car la dépense est créée
        setTimeout(() => onClose(), 2000);
      } else {
        setError(message || 'Erreur lors du scan de la facture. Vérifiez la console pour plus de détails.');
      }
      setUploading(false);
      setUploadProgress('uploading');
    }
  };

  const handleValidationClose = () => {
    setShowValidation(false);
    setScannedExpense(null);
    onClose();
  };

  const handleValidationSave = () => {
    setShowValidation(false);
    setScannedExpense(null);
    onClose();
    // Optionnel: recharger la liste des dépenses
    window.location.reload();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <h2 className="text-xl font-semibold text-slate-900">Nouvelle dépense</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6">
          {/* Onglets */}
          <div className="flex gap-2 mb-6 border-b border-slate-200">
            <button
              onClick={() => {
                setActiveTab('upload');
                stopCamera();
              }}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'upload'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <PhotoIcon className="w-5 h-5 inline mr-2" />
              Upload fichier
            </button>
            <button
              onClick={() => {
                setActiveTab('scan');
                void startCamera();
              }}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'scan'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <CameraIcon className="w-5 h-5 inline mr-2" />
              Scanner
            </button>
          </div>

          {/* Contenu Upload */}
          {activeTab === 'upload' && (
            <div>
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
                <p className="text-sm text-slate-400">
                  Formats supportés: JPG, PNG, PDF
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/jpg,application/pdf"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>

              {preview && (
                <div className="mt-4">
                  <img
                    src={preview}
                    alt="Preview"
                    className="max-w-full max-h-64 mx-auto rounded-lg border border-slate-200"
                  />
                </div>
              )}

              {file && (
                <div className="mt-4 p-3 bg-slate-50 rounded-lg">
                  <p className="text-sm text-slate-600">
                    Fichier sélectionné: <span className="font-medium">{file.name}</span>
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Taille: {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Contenu Scanner */}
          {activeTab === 'scan' && (
            <div>
              {!scanning && !preview && (
                <div className="text-center py-8">
                  <CameraIcon className="w-16 h-16 mx-auto mb-4 text-slate-400" />
                  <p className="text-slate-600 mb-4">
                    Cliquez sur "Démarrer la caméra" pour scanner une facture
                  </p>
                  <button
                    onClick={() => void startCamera()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Démarrer la caméra
                  </button>
                </div>
              )}

              {scanning && (
                <div className="space-y-4">
                  {/* Conteneur vidéo en format portrait */}
                  <div className="relative bg-black rounded-lg overflow-hidden flex items-center justify-center" style={{ 
                    width: '100%',
                    aspectRatio: '2/3', // Format portrait strict
                    maxWidth: '400px',
                    margin: '0 auto'
                  }}>
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full"
                      style={{
                        transform: 'scaleX(-1)', // Miroir horizontal pour UX
                        objectFit: 'cover' // Remplir le conteneur
                      }}
                    />
                    <canvas ref={canvasRef} className="hidden" />
                    
                    {/* Overlay pour guider l'utilisateur - format portrait */}
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                      <div className="border-2 border-white/80 rounded-lg shadow-lg" style={{
                        width: '85%',
                        aspectRatio: '2/3', // Format portrait pour factures
                        boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)' // Masque autour
                      }} />
                    </div>
                    
                    {/* Indicateur de chargement si vidéo pas prête */}
                    {(!videoRef.current || videoRef.current.readyState < 2) && (
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
                      onClick={capturePhoto}
                      disabled={!videoRef.current || videoRef.current.readyState < 2}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      Capturer
                    </button>
                    <button
                      onClick={stopCamera}
                      className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300"
                    >
                      Annuler
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 text-center">
                    Positionnez la facture dans le cadre vertical et appuyez sur Capturer
                  </p>
                </div>
              )}

              {preview && !scanning && (
                <div className="mt-4">
                  <img
                    src={preview}
                    alt="Capture"
                    className="max-w-full max-h-64 mx-auto rounded-lg border border-slate-200"
                  />
                  <button
                    onClick={() => {
                      setPreview(null);
                      setFile(null);
                      void startCamera();
                    }}
                    className="mt-2 w-full px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300"
                  >
                    Reprendre une photo
                  </button>
                </div>
              )}
            </div>
          )}


          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Barre de progression */}
          {uploading && (
            <div className="mt-6 space-y-3">
              <div className="bg-slate-100 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${
                    uploadProgress === 'uploading' ? 'w-1/4 bg-blue-500' :
                    uploadProgress === 'processing' ? 'w-2/4 bg-blue-500' :
                    uploadProgress === 'extracting' ? 'w-3/4 bg-blue-500' :
                    'w-full bg-green-500'
                  }`}
                />
              </div>
              <div className="flex items-center justify-center gap-2 text-sm text-slate-600">
                {uploadProgress === 'uploading' && (
                  <>
                    <svg className="animate-spin h-4 w-4 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Upload du fichier...</span>
                  </>
                )}
                {uploadProgress === 'processing' && (
                  <>
                    <svg className="animate-spin h-4 w-4 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Traitement du document...</span>
                  </>
                )}
                {uploadProgress === 'extracting' && (
                  <>
                    <svg className="animate-spin h-4 w-4 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Extraction des données (OCR)...</span>
                  </>
                )}
                {uploadProgress === 'complete' && (
                  <>
                    <svg className="h-4 w-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Terminé !</span>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="mt-6 flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200"
              disabled={uploading}
            >
              Annuler
            </button>
            <button
              onClick={handleSubmit}
              disabled={!file || uploading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? 'Traitement en cours...' : 'Scanner et créer'}
            </button>
          </div>
        </div>
      </div>

      {/* Modal de validation après scan */}
      {showValidation && scannedExpense && (
        <ExpenseValidationModal
          expense={scannedExpense}
          fileUrl={scannedExpense.fileUrl || preview || ''}
          fileType={scannedExpense.fileType || file?.type}
          fileName={scannedExpense.fileName || file?.name}
          onClose={handleValidationClose}
          onSave={handleValidationSave}
        />
      )}
    </div>
  );
}

