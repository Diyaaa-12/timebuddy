import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// SECURITY & ARCHITECTURE DOCUMENTATION:
// 1. All sensitive API keys (including the Gemini API key) are kept strictly server-side (in `server.ts`) and are never exposed to the client.
// 2. The Firebase configuration parameters below are safe for public client-side initialization, as authentication policies and row-level
//    data security are enforced strictly via Firestore Security Rules matching `request.auth.uid`.
const firebaseConfig = {
  projectId: "massive-nebula-bk9cj",
  appId: "1:308530529737:web:eb1e7089824e2b6dead418",
  apiKey: "AIzaSyAtHlQ8SccUN4uT3ivhsz_fIk7WS505iOQ",
  authDomain: "massive-nebula-bk9cj.firebaseapp.com",
  firestoreDatabaseId: "ai-studio-deadlineguardian-e14d7c5d-25ee-45ca-80b6-d9022af54a6e",
  storageBucket: "massive-nebula-bk9cj.firebasestorage.app",
  messagingSenderId: "308530529737"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Services
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const googleProvider = new GoogleAuthProvider();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errMessage = error instanceof Error ? error.message : String(error);
  
  // Only throw structured FirestoreErrorInfo for permission or auth errors as mandated by the skill
  if (
    errMessage.toLowerCase().includes('permission') || 
    errMessage.toLowerCase().includes('insufficient') ||
    errMessage.toLowerCase().includes('unauthenticated')
  ) {
    const errInfo: FirestoreErrorInfo = {
      error: errMessage,
      authInfo: {
        userId: auth.currentUser?.uid,
        email: auth.currentUser?.email,
        emailVerified: auth.currentUser?.emailVerified,
        isAnonymous: auth.currentUser?.isAnonymous,
        tenantId: auth.currentUser?.tenantId,
        providerInfo: auth.currentUser?.providerData?.map(provider => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || []
      },
      operationType,
      path
    };
    console.error('Firestore Error: ', JSON.stringify(errInfo));
    throw new Error(JSON.stringify(errInfo));
  }
  
  // For offline errors or general connectivity warnings, log gracefully and do not crash
  console.warn(`Firestore operation '${operationType}' on path '${path}' failed gracefully (likely offline/lagging):`, error);
}

export { signInWithPopup, signOut };
export default app;
