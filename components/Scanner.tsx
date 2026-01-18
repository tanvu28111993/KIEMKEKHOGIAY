import React, { useEffect, useRef, useState } from 'react';

// Extend Window interface for ZXing and BarcodeDetector
declare global {
    interface Window {
        ZXing: any;
        BarcodeDetector?: any;
    }
}

interface ScannerProps {
    onScanSuccess: (decodedText: string) => void;
    onClose: () => void;
    onError: (message: string) => void;
}

interface ZoomCapabilities {
    min: number;
    max: number;
    step: number;
}

// Global promise cache to prevent race conditions
const scriptLoadPromises: Record<string, Promise<void>> = {};

// Helper to dynamically load script safely
const loadScript = (src: string): Promise<void> => {
    // 1. If global exists (specific to ZXing in this context), resolve immediately
    if (window.ZXing) return Promise.resolve();

    // 2. If already loading, return existing promise
    if (scriptLoadPromises[src]) {
        return scriptLoadPromises[src];
    }

    // 3. Create new load promise
    const promise = new Promise<void>((resolve, reject) => {
        // Double check
        if (window.ZXing) {
            resolve();
            return;
        }

        // Check if script tag exists (maybe from SW or previous attempt)
        const existingScript = document.querySelector(`script[src="${src}"]`) as HTMLScriptElement;
        
        if (existingScript) {
            // Script exists but window.ZXing is missing -> It is likely loading or failed.
            // Attach new listeners to catch completion.
            const onExistingLoad = () => {
                 resolve();
                 existingScript.removeEventListener('load', onExistingLoad);
                 existingScript.removeEventListener('error', onExistingError);
            };
            const onExistingError = () => {
                 reject(new Error(`Failed to load existing script ${src}`));
                 existingScript.removeEventListener('load', onExistingLoad);
                 existingScript.removeEventListener('error', onExistingError);
            };

            existingScript.addEventListener('load', onExistingLoad);
            existingScript.addEventListener('error', onExistingError);
            return;
        }

        // Create new script tag
        const script = document.createElement('script');
        script.src = src;
        script.async = true;
        // script.crossOrigin = "anonymous"; // Optional: good for CORS but unpkg handles it
        script.onload = () => resolve();
        script.onerror = () => reject(new Error(`Failed to load script ${src}`));
        document.body.appendChild(script);
    });

    scriptLoadPromises[src] = promise;
    return promise;
};

const ZXING_URL = 'https://unpkg.com/@zxing/library@0.20.0';

const Scanner: React.FC<ScannerProps> = ({ onScanSuccess, onClose, onError }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const codeReader = useRef<any>(null);
    const barcodeDetectorRef = useRef<any>(null);
    const requestRef = useRef<number>(0);
    
    // Ref for Native Camera Input
    const nativeCamInputRef = useRef<HTMLInputElement>(null);
    
    const [error, setError] = useState<string | null>(null);
    const [isVideoReady, setIsVideoReady] = useState(false);
    const [isProcessingImg, setIsProcessingImg] = useState(false);
    const [isDownloadingLib, setIsDownloadingLib] = useState(false);
    const [useNativeDetector, setUseNativeDetector] = useState(false);
    
    // Zoom State
    const [zoomCap, setZoomCap] = useState<ZoomCapabilities | null>(null);
    const [currentZoom, setCurrentZoom] = useState<number>(1);

    // 1. SETUP SCANNER
    useEffect(() => {
        let mounted = true;

        const handleCameraError = (err: any) => {
            console.error("Scanner Error:", err);
            let msg = "Không thể truy cập Camera.";
            
            const errName = err?.name || '';
            const errMsg = err?.message || String(err);

            if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError' || errMsg.includes('Permission denied')) {
                msg = "Bạn đã chặn quyền Camera. Vui lòng bấm vào biểu tượng ổ khóa 🔒 trên thanh địa chỉ để mở lại, sau đó tải lại trang.";
            } else if (errName === 'NotFoundError' || errName === 'DevicesNotFoundError') {
                msg = "Không tìm thấy thiết bị Camera trên máy này.";
            } else if (errName === 'NotReadableError' || errName === 'TrackStartError') {
                msg = "Camera đang được sử dụng bởi ứng dụng khác. Hãy tắt các app khác và thử lại.";
            } else if (errName === 'OverconstrainedError') {
                msg = "Camera không hỗ trợ độ phân giải này. Đang thử cấu hình thấp hơn...";
            } else if (errMsg.includes('ZXing')) {
                msg = "Lỗi thư viện quét mã. Vui lòng kiểm tra kết nối mạng và thử lại.";
            }

            if (mounted) setError(msg);
        };

        const initScanner = async () => {
             // Feature detection for BarcodeDetector (Chrome Android/iOS 17+)
            const hasBarcodeDetector = 'BarcodeDetector' in window;
            
            if (hasBarcodeDetector) {
                try {
                    // Initialize Native Detector
                    // @ts-ignore
                    const formats = await window.BarcodeDetector.getSupportedFormats();
                    if (formats.includes('qr_code')) {
                        // @ts-ignore
                        barcodeDetectorRef.current = new window.BarcodeDetector({
                            formats: ['qr_code', 'code_128', 'ean_13', 'ean_8', 'itf']
                        });
                        if (mounted) setUseNativeDetector(true);
                        startNativeStream();
                        return;
                    }
                } catch (e) {
                    console.warn("BarcodeDetector Init Failed", e);
                }
            }

            // Fallback: Lazy Load ZXing
            if (mounted) setIsDownloadingLib(true);
            try {
                if (!window.ZXing) {
                    await loadScript(ZXING_URL);
                }
                
                // Double check if it actually loaded
                if (!window.ZXing) {
                    throw new Error("ZXing loaded but window.ZXing is undefined");
                }

                if (mounted) {
                    setIsDownloadingLib(false);
                    startZXing();
                }
            } catch (err) {
                if (mounted) {
                    setIsDownloadingLib(false);
                    handleCameraError(err);
                }
            }
        };

        const startNativeStream = async () => {
             try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { 
                        facingMode: 'environment',
                        width: { ideal: 1920 }, 
                        height: { ideal: 1080 },
                        // @ts-ignore
                        focusMode: { ideal: 'continuous' } 
                    }
                });
                
                if (videoRef.current && mounted) {
                    videoRef.current.srcObject = stream;
                    videoRef.current.onloadedmetadata = () => {
                            if (videoRef.current) videoRef.current.play().catch(e => console.error("Play error", e));
                            
                            const track = stream.getVideoTracks()[0];
                            if (track && (track as any).getCapabilities) {
                            const caps = (track as any).getCapabilities();
                            if (caps.zoom && mounted) {
                                setZoomCap({ min: caps.zoom.min, max: caps.zoom.max, step: caps.zoom.step });
                            }
                            }
                            if (mounted) {
                                setIsVideoReady(true);
                                detectLoop();
                            }
                    };
                }
            } catch (err: any) {
                // IMPORTANT: Check for permission denial here first.
                // If denied, do NOT fallback to ZXing as it will fail too.
                if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                    handleCameraError(err);
                    return;
                }

                console.warn("Native Stream Failed, switching to ZXing fallback logic", err);
                
                if (mounted) {
                     setUseNativeDetector(false);
                     // Try to load ZXing now
                     setIsDownloadingLib(true);
                     try {
                        if (!window.ZXing) await loadScript(ZXING_URL);
                         // Double check
                        if (!window.ZXing) throw new Error("ZXing missing after load");
                        
                        setIsDownloadingLib(false);
                        startZXing();
                     } catch (e) {
                         handleCameraError(e);
                     }
                }
            }
        };

        const startZXing = () => {
             if (!window.ZXing) {
                handleCameraError("Lỗi thư viện quét mã.");
                return;
            }

            const reader = new window.ZXing.BrowserQRCodeReader();
            codeReader.current = reader;

            // Use simplified constraints first
            const constraints = {
                video: {
                    facingMode: "environment",
                    width: { ideal: 1280 }
                }
            };

            reader.decodeFromConstraints(
                constraints,
                videoRef.current,
                (result: any, err: any) => {
                    if (result) {
                        const text = result.getText();
                        if (text) {
                            if (navigator.vibrate) navigator.vibrate(50);
                            onScanSuccess(text);
                        }
                    }
                }
            ).then(() => {
                if (videoRef.current && videoRef.current.srcObject) {
                    const stream = videoRef.current.srcObject as MediaStream;
                    const track = stream.getVideoTracks()[0];
                    if (track && (track as any).getCapabilities) {
                        const caps = (track as any).getCapabilities();
                        if (caps.zoom && mounted) {
                            setZoomCap({ min: caps.zoom.min, max: caps.zoom.max, step: caps.zoom.step });
                        }
                    }
                    if (mounted) setIsVideoReady(true);
                }
            }).catch((err: any) => {
                // ZXing often throws simple strings or Error objects
                handleCameraError(err);
            });
        };

        const detectLoop = async () => {
             if (!videoRef.current || videoRef.current.paused || !barcodeDetectorRef.current) {
                 requestRef.current = requestAnimationFrame(detectLoop);
                 return;
             }

             try {
                 const barcodes = await barcodeDetectorRef.current.detect(videoRef.current);
                 if (barcodes.length > 0) {
                     const text = barcodes[0].rawValue;
                     if (text) {
                         if (navigator.vibrate) navigator.vibrate(50);
                         onScanSuccess(text);
                         return; 
                     }
                 }
             } catch (e) {
                 // Ignore frame error
             }
             requestRef.current = requestAnimationFrame(detectLoop);
        };

        initScanner();

        return () => {
            mounted = false;
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
            
            if (videoRef.current && videoRef.current.srcObject) {
                const stream = videoRef.current.srcObject as MediaStream;
                stream.getTracks().forEach(track => {
                    track.stop();
                    // Some browsers need track enabled=false before stop to fully release
                    track.enabled = false;
                });
                videoRef.current.srcObject = null;
            }

            if (codeReader.current) {
                codeReader.current.reset();
            }
        };
    }, [onScanSuccess]);

    // 2. HANDLE ZOOM CHANGE (Hardware Digital Zoom)
    const handleZoomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const zoomValue = parseFloat(e.target.value);
        setCurrentZoom(zoomValue);

        if (videoRef.current && videoRef.current.srcObject) {
            const stream = videoRef.current.srcObject as MediaStream;
            const track = stream.getVideoTracks()[0];
            
            if (track && track.applyConstraints) {
                track.applyConstraints({
                    advanced: [{ zoom: zoomValue } as any]
                }).catch(err => console.warn("Zoom not applied:", err));
            }
        }
    };

    // 3. HANDLE NATIVE CAMERA SCAN (File Input - Static Image)
    const handleNativeCameraScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setIsProcessingImg(true);
            const file = e.target.files[0];
            const imageUrl = URL.createObjectURL(file);
            
            // Ensure libraries are loaded for image processing if not already
            if (!('BarcodeDetector' in window) && !window.ZXing) {
                 try {
                     await loadScript(ZXING_URL);
                 } catch (e) {
                     onError("Không thể tải thư viện xử lý ảnh.");
                     setIsProcessingImg(false);
                     URL.revokeObjectURL(imageUrl);
                     return;
                 }
            }

            const img = new Image();
            img.src = imageUrl;

            try {
                await img.decode(); // Wait for image load

                let text = '';
                
                // Try Native Detector
                if ('BarcodeDetector' in window && barcodeDetectorRef.current) {
                    try {
                        const barcodes = await barcodeDetectorRef.current.detect(img);
                        if (barcodes.length > 0) text = barcodes[0].rawValue;
                    } catch (e) { /* ignore */ }
                } else if ('BarcodeDetector' in window) {
                     // Try to instantiate if ref is missing
                     try {
                        // @ts-ignore
                        const detector = new window.BarcodeDetector();
                        const barcodes = await detector.detect(img);
                        if (barcodes.length > 0) text = barcodes[0].rawValue;
                     } catch(e) { /* ignore */ }
                }

                // Fallback to ZXing
                if (!text) {
                     if (!window.ZXing) await loadScript(ZXING_URL);
                     if (!codeReader.current) codeReader.current = new window.ZXing.BrowserQRCodeReader();
                     const result = await codeReader.current.decodeFromImageUrl(imageUrl);
                     if (result) text = result.getText();
                }

                if (text) {
                    if (navigator.vibrate) navigator.vibrate(50);
                    onScanSuccess(text);
                } else {
                    onError("Không tìm thấy mã QR trong ảnh.");
                }

            } catch (err) {
                console.error(err);
                onError("Không thể đọc ảnh. Vui lòng thử lại.");
            } finally {
                setIsProcessingImg(false);
                URL.revokeObjectURL(imageUrl);
                if (nativeCamInputRef.current) nativeCamInputRef.current.value = '';
            }
        }
    };

    return (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col animate-fadeIn">
            <input 
                type="file" 
                ref={nativeCamInputRef}
                accept="image/*"
                capture="environment" 
                className="hidden"
                onChange={handleNativeCameraScan}
            />

            <div className="relative flex-1 bg-black overflow-hidden flex flex-col justify-center items-center">
                {error ? (
                    <div className="px-6 text-center animate-fadeInUp">
                         <div className="w-20 h-20 bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-500/30">
                             <span className="material-symbols-outlined text-red-500 text-4xl">videocam_off</span>
                        </div>
                        <h3 className="text-xl text-white font-bold mb-3">Lỗi Camera</h3>
                        <p className="text-gray-400 text-sm mb-8 leading-relaxed max-w-[280px] mx-auto">{error}</p>
                        
                        <div className="flex flex-col gap-3 w-full max-w-xs mx-auto">
                            <button onClick={() => window.location.reload()} className="bg-brand text-white px-8 py-3 rounded-xl font-bold active:scale-95 transition-transform flex items-center justify-center gap-2">
                                <span className="material-symbols-outlined">refresh</span>
                                Tải lại trang
                            </button>
                            <button onClick={onClose} className="bg-[#2a2a2a] text-gray-300 px-8 py-3 rounded-xl font-bold active:scale-95 transition-transform">
                                Quay lại
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                        <video 
                            ref={videoRef} 
                            className={`w-full h-full object-cover absolute inset-0 transition-opacity duration-700 ${isVideoReady ? 'opacity-100' : 'opacity-0'}`}
                            playsInline
                            muted
                        />

                        {isProcessingImg && (
                            <div className="absolute inset-0 z-50 bg-black/80 flex flex-col items-center justify-center backdrop-blur-sm">
                                <div className="w-12 h-12 border-4 border-white/20 border-t-brand rounded-full animate-spin mb-4"></div>
                                <p className="text-white font-bold">Đang xử lý ảnh...</p>
                            </div>
                        )}

                        {/* Downloading Library State */}
                        {isDownloadingLib && (
                             <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 z-50 bg-black">
                                <div className="w-12 h-12 border-4 border-white/20 border-t-blue-500 rounded-full animate-spin"></div>
                                <p className="text-xs text-blue-400 font-bold uppercase tracking-widest animate-pulse">Đang tải thư viện quét...</p>
                            </div>
                        )}

                        {!isVideoReady && !isProcessingImg && !isDownloadingLib && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 z-0">
                                <div className="w-12 h-12 border-4 border-white/20 border-t-brand rounded-full animate-spin"></div>
                                <p className="text-xs text-gray-400 font-bold uppercase tracking-widest animate-pulse">Đang mở camera...</p>
                            </div>
                        )}

                        {isVideoReady && !isProcessingImg && (
                            <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none animate-fadeIn">
                                <div className="relative w-[280px] h-[280px] rounded-[2rem] shadow-[0_0_0_9999px_rgba(0,0,0,0.7)]">
                                    <div className="absolute top-0 left-0 w-10 h-10 border-t-[5px] border-l-[5px] border-brand rounded-tl-2xl shadow-sm"></div>
                                    <div className="absolute top-0 right-0 w-10 h-10 border-t-[5px] border-r-[5px] border-brand rounded-tr-2xl shadow-sm"></div>
                                    <div className="absolute bottom-0 left-0 w-10 h-10 border-b-[5px] border-l-[5px] border-brand rounded-bl-2xl shadow-sm"></div>
                                    <div className="absolute bottom-0 right-0 w-10 h-10 border-b-[5px] border-r-[5px] border-brand rounded-br-2xl shadow-sm"></div>
                                    <div className="absolute left-4 right-4 h-[2px] bg-brand shadow-[0_0_20px_rgba(218,41,28,0.9)] animate-scan top-1/2 rounded-full"></div>
                                    <div className="absolute -top-16 left-0 right-0 text-center">
                                        <div className="inline-flex items-center gap-2 bg-black/50 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 shadow-lg">
                                            <span className="material-symbols-outlined text-brand text-sm">qr_code_2</span>
                                            <span className="text-white text-[11px] font-bold tracking-wide uppercase">
                                                {useNativeDetector ? 'AI Scan (Google Chrome)' : 'Di chuyển mã vào khung'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="absolute z-20 bottom-0 left-0 right-0 px-6 pb-safe-bottom bg-gradient-to-t from-black/95 via-black/80 to-transparent pt-10">
                            {zoomCap && isVideoReady && (
                                <div className="mb-6 flex items-center justify-center gap-4 w-full max-w-[320px] mx-auto animate-fadeInUp bg-black/40 backdrop-blur-md p-2 rounded-2xl border border-white/10">
                                    <span className="material-symbols-outlined text-white/70 text-sm">remove_circle</span>
                                    <input 
                                        type="range" 
                                        min={zoomCap.min} 
                                        max={zoomCap.max} 
                                        step={zoomCap.step} 
                                        value={currentZoom}
                                        onChange={handleZoomChange}
                                        className="w-full h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-brand"
                                        style={{ outline: 'none' }}
                                    />
                                    <span className="material-symbols-outlined text-white text-sm">add_circle</span>
                                </div>
                            )}

                            <div className="flex gap-3 items-center justify-center mb-6">
                                <button 
                                    onClick={onClose}
                                    className="flex-1 h-14 bg-brand hover:bg-red-700 border border-white/10 text-white font-bold rounded-2xl active:scale-[0.98] transition-all flex items-center justify-center shadow-lg gap-2"
                                >
                                    <span className="material-symbols-outlined text-xl">close</span>
                                    <span className="text-[13px] uppercase tracking-wider">Đóng</span>
                                </button>
                                <button 
                                    onClick={() => nativeCamInputRef.current?.click()}
                                    className="w-16 h-14 rounded-2xl bg-[#FF8C00] hover:bg-orange-600 backdrop-blur-md border border-white/20 flex items-center justify-center text-white active:scale-95 transition-transform shadow-lg"
                                    title="Chụp ảnh (Camera Gốc)"
                                >
                                    <span className="material-symbols-outlined text-2xl">photo_camera</span>
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default Scanner;