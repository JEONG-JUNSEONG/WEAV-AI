import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { auth, loginWithGoogle, logout } from '../services/firebase';
import { userService } from '../services/userService';

interface UserInfo {
  uid: string;
  email?: string;
  display_name?: string;
  photo_url?: string;
  membership_type?: 'free' | 'standard' | 'premium';
  membership_expires_at?: string | null;
  is_membership_active?: boolean;
  can_use_premium_features?: boolean;
  has_openai_key?: boolean;
  has_gemini_key?: boolean;
}

interface AuthContextType {
  user: User | null;
  userInfo: UserInfo | null;
  loading: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Firebase 인증 상태 확인 (개발/프로덕션 모두)
    if (!auth) {
      console.warn("AuthContext: Firebase auth not initialized");
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          // Firestore 동기화
          await userService.syncUserToFirestore(currentUser);
          // 백엔드 JWT 토큰 발급 (멤버십 정보 포함)
          await userService.verifyFirebaseToken(currentUser);
          // 저장된 사용자 정보 로드
          const saved = localStorage.getItem('weav_user_info');
          if (saved) {
            try {
              setUserInfo(JSON.parse(saved));
            } catch (e) {
              console.error('Failed to parse user info:', e);
            }
          }
        } catch (error) {
          console.error("Failed to sync user or verify token:", error);
        }
      } else {
        // 로그아웃 시 토큰 및 사용자 정보 정리
        userService.clearAuth();
        localStorage.removeItem('weav_user_info');
        setUserInfo(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const signIn = async () => {
    // 실제 Firebase Google 로그인 사용 (개발/프로덕션 모두)
    if (!auth) {
      console.error("Firebase auth not initialized. Please check your Firebase configuration.");
      return;
    }

    try {
      const firebaseUser = await loginWithGoogle();
      if (firebaseUser) {
        // Firestore 동기화 및 백엔드 JWT 토큰 발급
        await userService.syncUserToFirestore(firebaseUser);
        await userService.verifyFirebaseToken(firebaseUser);
      }
    } catch (error) {
      console.error("Login failed", error);
      throw error; // 에러를 상위로 전파하여 UI에서 처리할 수 있도록
    }
  };

  const signOut = async () => {
    // 실제 Firebase 로그아웃 사용 (개발/프로덕션 모두)
    if (!auth) {
      console.warn("Firebase auth not initialized");
      setUser(null);
      return;
    }

    try {
      // 로그아웃 전에 현재 사용자 데이터 정리 (선택사항)
      const currentUser = user;
      
      await logout();
      setUser(null);
      setUserInfo(null);
      localStorage.removeItem('weav_user_info');
      
      // 로그아웃 후 채팅 상태 초기화는 ChatContext에서 처리
      // 여기서는 사용자 상태만 관리
    } catch (error) {
      console.error("Logout failed", error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ user, userInfo, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};