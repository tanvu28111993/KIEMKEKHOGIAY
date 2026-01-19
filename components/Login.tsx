import React, { useState, useEffect } from 'react';
import { api } from '../api';

interface LoginProps {
    onLogin: (username: string) => void;
    onError: (message: string) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin, onError }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [permStatus, setPermStatus] = useState<'idle' | 'granted' | 'denied'>('idle');
    const [showManualGuide, setShowManualGuide] = useState(false);

    useEffect(() => {
        // Check initial permission state (Chrome/Edge only)
        if (navigator.permissions && navigator.permissions.query) {
            navigator.permissions.query({ name: 'camera' as any }).then(res => {
                if (res.state === 'granted') {
                    setPermStatus('granted');
                } else if (res.state === 'denied') {
                    setPermStatus('denied');
                    setShowManualGuide(true);
                }
                
                // Listen for changes (e.g. user changes setting via lock icon)
                res.onchange = () => {
                    if (res.state === 'granted') {
                        setPermStatus('granted');
                        setShowManualGuide(false);
                    } else if (res.state === 'denied') {
                        setPermStatus('denied');
                        setShowManualGuide(true);
                    }
                };
            }).catch(() => {});
        }
    }, []);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!username.trim() || !password.trim()) {
            onError("Vui lòng nhập đầy đủ thông tin!");
            return;
        }

        setIsLoading(true);

        try {
            const isValid = await api.checkLogin(username, password);
            setIsLoading(false);
            if (isValid) {
                onLogin(username);
            } else {
                onError("Sai thông tin đăng nhập!");
            }
        } catch (error: any) {
            setIsLoading(false);
            console.error("Login API Error:", error);
            onError("Lỗi kết nối: " + (error.message || "Không thể kết nối server"));
        }
    };

    const requestCameraPermission = async () => {
        try {
            setIsLoading(true);
            
            // This line triggers the browser popup
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            
            // If we get here, User clicked "Allow"
            setPermStatus('granted');
            setShowManualGuide(false);
            if (navigator.vibrate) navigator.vibrate(100);
            
            // Stop stream immediately to save battery
            stream.getTracks().forEach(track => track.stop());
            setIsLoading(false);
            
        } catch (err: any) {
            console.error("Camera permission denied:", err);
            setIsLoading(false);
            setPermStatus('denied');
            setShowManualGuide(true); // Show visual guide
            if (navigator.vibrate) navigator.vibrate([50, 50, 50]);
        }
    };

    return (
        <div className="relative w-full min-h-[100dvh] flex flex-col items-center justify-center bg-[#0a0a0a] overflow-hidden animate-fadeIn">
            
            {/* Background Effects */}
            <div className="absolute top-0 left-0 w-full h-[60vh] bg-gradient-to-b from-brand/20 to-transparent opacity-60 pointer-events-none"></div>
            <div className="absolute -top-40 -right-40 w-96 h-96 bg-brand/30 rounded-full blur-[100px] animate-pulse pointer-events-none"></div>
            
            {/* Main Content */}
            <div className="relative z-10 w-full max-w-sm px-6 flex flex-col items-center pb-safe-bottom transition-all duration-500">
                
                {/* Logo */}
                <div className={`relative group mb-6 transition-all duration-700 ${permStatus === 'granted' ? 'scale-75 mb-4' : 'scale-100'}`}>
                    <div className="absolute inset-0 bg-brand blur-2xl opacity-20 group-hover:opacity-40 transition-opacity duration-700 rounded-full"></div>
                    <div className="relative w-64 h-64 sm:w-80 sm:h-80 flex items-center justify-center transform group-hover:scale-105 transition-all duration-500">
                        <img 
                            src="https://i.postimg.cc/8zF3c24h/image.png" 
                            alt="Warehouse Icon"
                            className="w-full h-full object-contain drop-shadow-2xl"
                        />
                    </div>
                </div>

                {/* Title */}
                <div className="text-center mb-8 space-y-2">
                    <h1 className="text-3xl font-black text-white tracking-tighter drop-shadow-xl font-[system-ui] uppercase">
                        Kiểm Kê Kho Giấy
                    </h1>
                    <div className="flex items-center justify-center gap-3">
                         <div className="h-[1px] w-8 bg-gray-600"></div>
                         <p className="text-xs font-bold text-brand uppercase tracking-[0.3em]">Mobile App</p>
                         <div className="h-[1px] w-8 bg-gray-600"></div>
                    </div>
                </div>

                {/* --- STATE 1: PERMISSION REQUEST --- */}
                {permStatus !== 'granted' && (
                    <div className="w-full flex flex-col items-center animate-[fadeInUp_0.5s_ease-out]">
                        
                        {/* Status Card */}
                        <div className={`bg-[#1A1A1A] border ${showManualGuide ? 'border-red-500/30' : 'border-white/5'} rounded-2xl p-6 w-full text-center shadow-2xl mb-6 transition-all`}>
                            <div className={`w-16 h-16 rounded-full mx-auto flex items-center justify-center mb-4 transition-colors ${showManualGuide ? 'bg-red-500/10 text-red-500' : 'bg-brand/10 text-brand'}`}>
                                <span className="material-symbols-outlined text-3xl">
                                    {showManualGuide ? 'lock' : 'qr_code_scanner'}
                                </span>
                            </div>
                            
                            <h3 className="text-white font-bold text-lg mb-2">
                                {showManualGuide ? 'Quyền bị chặn' : 'Yêu cầu truy cập'}
                            </h3>
                            
                            {showManualGuide ? (
                                <div className="text-sm text-left bg-black/30 p-3 rounded-lg border border-white/5 space-y-2">
                                    <p className="text-red-400 font-bold text-center mb-2">Không thể tự mở Camera</p>
                                    <div className="flex items-start gap-2 text-gray-300">
                                        <span className="material-symbols-outlined text-base text-gray-500 mt-0.5">looks_one</span>
                                        <span>Bấm vào biểu tượng <strong className="text-white">Ổ khóa (🔒)</strong> hoặc <strong className="text-white">Aa</strong> trên thanh địa chỉ.</span>
                                    </div>
                                    <div className="flex items-start gap-2 text-gray-300">
                                        <span className="material-symbols-outlined text-base text-gray-500 mt-0.5">looks_two</span>
                                        <span>Chọn <strong>Quyền trang web</strong> hoặc <strong>Camera</strong>.</span>
                                    </div>
                                    <div className="flex items-start gap-2 text-gray-300">
                                        <span className="material-symbols-outlined text-base text-gray-500 mt-0.5">looks_3</span>
                                        <span>Chọn <strong>Cho phép</strong> sau đó tải lại trang.</span>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-gray-400 text-sm leading-relaxed">
                                    Ứng dụng cần sử dụng Camera để quét mã SKU.<br/>
                                    Vui lòng bấm nút bên dưới và chọn <strong>"Cho phép"</strong>.
                                </p>
                            )}
                        </div>

                        {showManualGuide ? (
                             <button 
                                onClick={() => window.location.reload()}
                                className="w-full bg-[#333] hover:bg-[#444] text-white font-bold py-4 rounded-2xl border border-white/10 flex items-center justify-center gap-2 active:scale-95 transition-all"
                            >
                                <span className="material-symbols-outlined">refresh</span>
                                ĐÃ MỞ, TẢI LẠI TRANG
                            </button>
                        ) : (
                            <button 
                                onClick={requestCameraPermission}
                                disabled={isLoading}
                                className="w-full bg-brand hover:bg-red-600 text-white font-bold py-4 rounded-2xl shadow-[0_0_30px_-5px_rgba(218,41,28,0.6)] transform transition-all active:scale-[0.97] flex items-center justify-center border-t border-white/10 group overflow-hidden relative"
                            >
                                {isLoading ? (
                                    <span className="material-symbols-outlined animate-spin text-2xl">progress_activity</span>
                                ) : (
                                    <>
                                        <span className="absolute inset-0 bg-white/20 translate-x-[-100%] animate-[scan_2s_infinite]"></span>
                                        <span className="tracking-wide text-lg flex items-center relative z-10">
                                            BẬT CAMERA
                                            <span className="material-symbols-outlined ml-2">videocam</span>
                                        </span>
                                    </>
                                )}
                            </button>
                        )}
                    </div>
                )}

                {/* --- STATE 2: LOGIN FORM --- */}
                {permStatus === 'granted' && (
                    <div className="w-full animate-slideInRight">
                        <div className="flex items-center justify-center mb-6 animate-fadeIn">
                            <div className="bg-green-500/10 border border-green-500/30 px-3 py-1.5 rounded-full flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                                <span className="text-[11px] text-green-400 font-bold uppercase tracking-wide">Camera Sẵn Sàng</span>
                            </div>
                        </div>

                        <form onSubmit={handleLogin} className="space-y-4">
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
                                    <span className="material-symbols-outlined text-gray-400 group-focus-within:text-brand transition-colors text-xl">badge</span>
                                </div>
                                <input 
                                    type="text" 
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    placeholder="Mã nhân viên" 
                                    className="w-full bg-[#1A1A1A] text-white placeholder-gray-500 rounded-2xl pl-12 pr-4 py-4 border border-white/5 focus:border-brand/50 focus:ring-4 focus:ring-brand/10 focus:outline-none transition-all font-semibold shadow-inner text-[16px]"
                                    autoCapitalize="none"
                                />
                            </div>

                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
                                    <span className="material-symbols-outlined text-gray-400 group-focus-within:text-brand transition-colors text-xl">lock</span>
                                </div>
                                <input 
                                    type="password" 
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Mật khẩu" 
                                    className="w-full bg-[#1A1A1A] text-white placeholder-gray-500 rounded-2xl pl-12 pr-4 py-4 border border-white/5 focus:border-brand/50 focus:ring-4 focus:ring-brand/10 focus:outline-none transition-all font-semibold shadow-inner text-[16px]"
                                />
                            </div>

                            <button 
                                type="submit"
                                disabled={isLoading}
                                className="w-full mt-4 bg-brand hover:bg-red-600 text-white font-bold py-4 rounded-2xl shadow-[0_10px_30px_-10px_rgba(218,41,28,0.5)] transform transition-all active:scale-[0.97] flex items-center justify-center border-t border-white/10 group relative overflow-hidden"
                            >
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:animate-[slideInRight_1s_ease-out]"></div>
                                {isLoading ? (
                                    <span className="material-symbols-outlined animate-spin text-2xl">progress_activity</span>
                                ) : (
                                    <span className="tracking-wide text-lg flex items-center">
                                        ĐĂNG NHẬP
                                        <span className="material-symbols-outlined ml-2 group-hover:translate-x-1 transition-transform">login</span>
                                    </span>
                                )}
                            </button>
                        </form>
                    </div>
                )}

                <div className="mt-12 text-center opacity-40">
                    <p className="text-[10px] uppercase tracking-widest text-gray-500 font-semibold">Hệ thống kiểm kê kho giấy</p>
                    <p className="text-[10px] text-gray-600 mt-1">v2.0.0 • PTB BULD 2026 </p>
                </div>
            </div>
        </div>
    );
};

export default Login;