import React, { useRef, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'sonner';

interface ProtectedRouteProps {
    children: React.ReactNode;
}

// 전역으로 토스트 표시 여부 추적 (컴포넌트 재마운트 시에도 유지)
const globalToastShown = { value: false };

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
    const { user, loading } = useAuth();
    const location = useLocation();
    const hasShownForThisPath = useRef<string | null>(null);

    useEffect(() => {
        // 로딩이 끝나고 user가 없을 때만 한 번만 토스트 표시
        if (!loading && !user) {
            // 같은 경로에서 이미 표시했으면 스킵
            if (hasShownForThisPath.current === location.pathname) {
                return;
            }
            // 전역적으로도 한 번만 표시 (페이지 새로고침 시 리셋)
            if (!globalToastShown.value) {
                globalToastShown.value = true;
                hasShownForThisPath.current = location.pathname;
                toast.error("로그인이 필요합니다.", { duration: 2000 });
            }
        }
        // user가 다시 생기면 리셋
        if (user) {
            globalToastShown.value = false;
            hasShownForThisPath.current = null;
        }
    }, [loading, user, location.pathname]);

    if (loading) {
        // 로딩 중일 때는 스피너 표시
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <div className="w-8 h-8 border-4 border-gray-300 border-t-gray-900 rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-600 dark:text-gray-400">로딩 중...</p>
                </div>
            </div>
        );
    }

    // 로그인 체크 (개발/프로덕션 모두)
    if (!user) {
        return <Navigate to="/login" replace />;
    }

    return <>{children}</>;
};
