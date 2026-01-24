import React from 'react';
import { X, Crown, Zap, Sparkles } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

interface MembershipModalProps {
  isOpen: boolean;
  onClose: () => void;
  requiredFeature?: string; // 어떤 기능을 사용하려고 했는지
}

export const MembershipModal: React.FC<MembershipModalProps> = ({
  isOpen,
  onClose,
  requiredFeature
}) => {
  const { user, signIn } = useAuth();
  const navigate = useNavigate();

  if (!isOpen) return null;

  const handleLogin = async () => {
    try {
      await signIn();
      onClose();
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  const handleUpgrade = () => {
    // TODO: 결제 페이지로 이동
    navigate('/pricing');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl shadow-2xl max-w-md w-full mx-4 border border-gray-200 dark:border-gray-800">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Crown className="w-6 h-6 text-yellow-500" />
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                멤버십이 필요합니다
              </h2>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {requiredFeature && (
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              <strong className="text-gray-900 dark:text-white">{requiredFeature}</strong> 기능을 사용하려면 멤버십이 필요합니다.
            </p>
          )}

          <div className="space-y-3 mb-6">
            <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
              <Zap className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">스탠다드 멤버십</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  모든 AI 모델 사용 가능, 무제한 생성
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
              <Sparkles className="w-5 h-5 text-purple-500 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">프리미엄 멤버십</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  우선 처리, 고품질 생성, API 키 연동
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            {!user ? (
              <button
                onClick={handleLogin}
                className="flex-1 bg-black dark:bg-white text-white dark:text-black px-4 py-3 rounded-lg font-semibold hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors"
              >
                로그인하기
              </button>
            ) : (
              <button
                onClick={handleUpgrade}
                className="flex-1 bg-gradient-to-r from-blue-500 to-purple-600 text-white px-4 py-3 rounded-lg font-semibold hover:from-blue-600 hover:to-purple-700 transition-all"
              >
                멤버십 업그레이드
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              나중에
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
