import { getFirestore, doc, getDoc, setDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { app } from './firebase';
import { apiClient, tokenManager } from './apiClient';
import { toast } from 'sonner';

const db = getFirestore(app);

export const userService = {
    /**
     * Firebase ID Token을 백엔드로 전송하여 JWT 토큰 발급
     */
    verifyFirebaseToken: async (user: User): Promise<void> => {
        if (!user) return;

        try {
            // Firebase ID Token 가져오기
            const idToken = await user.getIdToken();
            
            // 백엔드에 토큰 검증 요청 (인증 없이 호출)
            const response = await fetch(`${import.meta.env.DEV ? 'http://localhost:8080' : (import.meta.env.VITE_API_BASE_URL || 'https://weavai.hub')}/api/v1/auth/verify-firebase-token/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    id_token: idToken,
                }),
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
                throw new Error(errorData.error || `HTTP ${response.status}`);
            }
            
            const data = await response.json();
            
            // JWT 토큰 저장
            tokenManager.setAccessToken(data.access);
            tokenManager.setRefreshToken(data.refresh);
            
            // 사용자 정보 저장 (멤버십 등)
            if (data.user) {
                localStorage.setItem('weav_user_info', JSON.stringify(data.user));
            }
            
            console.log('[UserService] JWT tokens issued successfully');
        } catch (error) {
            console.error('[UserService] Failed to verify Firebase token:', error);
            // Firestore 동기화는 계속 진행 (백엔드 실패해도 프론트엔드는 작동)
        }
    },

    /**
     * Syncs the Firebase Auth user to Firestore 'users' collection.
     * Creates the document if it doesn't exist.
     */
    syncUserToFirestore: async (user: User) => {
        if (!user) return;

        try {
            const userRef = doc(db, 'users', user.uid);
            const userSnap = await getDoc(userRef);

            if (!userSnap.exists()) {
                // New User
                await setDoc(userRef, {
                    uid: user.uid,
                    email: user.email,
                    displayName: user.displayName,
                    photoURL: user.photoURL,
                    createdAt: serverTimestamp(),
                    lastLoginAt: serverTimestamp(),
                    plan: 'free', // Default plan
                });
                console.log(`[UserService] Created new user profile for ${user.email}`);
            } else {
                // Existing User - Update login time
                await updateDoc(userRef, {
                    lastLoginAt: serverTimestamp(),
                    photoURL: user.photoURL, // Sync latest photo
                    displayName: user.displayName // Sync latest name
                });
                console.log(`[UserService] Updated user profile for ${user.email}`);
            }
            
            // 백엔드 JWT 토큰 발급은 AuthContext에서 처리
        } catch (error) {
            console.error('[UserService] Failed to sync user:', error);
        }
    },
    
    /**
     * 로그아웃 시 토큰 정리
     */
    clearAuth: (): void => {
        tokenManager.clearTokens();
    }
};
