import React, { useState, useEffect, useCallback, Component, ErrorInfo, ReactNode } from 'react';
import { 
  Fuel, 
  Search, 
  User as UserIcon, 
  Settings, 
  History, 
  Plus, 
  LogOut, 
  Shield, 
  MapPin, 
  Car, 
  AlertCircle,
  TrendingUp,
  FileText,
  Users,
  CheckCircle2,
  XCircle,
  Phone,
  CreditCard,
  Home,
  QrCode,
  Camera,
  ChevronRight,
  BarChart3,
  Droplets
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { QRCodeCanvas } from 'qrcode.react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, startOfDay, endOfDay, subDays } from 'date-fns';
import { 
  collection, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  where, 
  orderBy, 
  limit, 
  onSnapshot,
  setDoc,
  getDoc,
  Timestamp,
  increment,
  runTransaction,
  serverTimestamp
} from 'firebase/firestore';
import { 
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged, 
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword
} from 'firebase/auth';
import { db, auth, secondaryAuth } from './firebase';
import { User, Role, Vehicle, FuelStation, FuelTransaction, VehicleType, AuditLog, VehicleTypeLimit, FuelDistribution } from './types';
import TrafficBar from './components/TrafficBar';

// --- Firebase Error Handling ---
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// --- Export Utilities ---
const exportToExcel = (data: any[], fileName: string) => {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  XLSX.writeFile(wb, `${fileName}.xlsx`);
};

const exportToCSV = (data: any[], fileName: string) => {
  const ws = XLSX.utils.json_to_sheet(data);
  const csv = XLSX.utils.sheet_to_csv(ws);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", `${fileName}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

const importFromCSV = (file: File, callback: (data: any[]) => void) => {
  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    complete: (results) => {
      callback(results.data);
    }
  });
};

const exportToPDF = (headers: string[], data: any[][], fileName: string, title: string) => {
  const doc = new jsPDF();
  doc.text(title, 14, 15);
  autoTable(doc, {
    head: [headers],
    body: data,
    startY: 20,
  });
  doc.save(`${fileName}.pdf`);
};

// --- Mock/API Service ---
const getErrorMessage = (err: any) => {
  try {
    const parsed = JSON.parse(err.message);
    return parsed.error || err.message;
  } catch (e) {
    return err.message || 'An error occurred';
  }
};

const api = {
  createSystemUser: async (data: any) => {
    try {
      // Generate a unique ID for the user since we aren't using Firebase Auth for these users
      const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const userRef = doc(db, 'users', userId);
      
      const user = {
        username: data.username,
        password: data.password, // Storing password for custom auth as requested
        role: data.role,
        station_id: data.station_id || null,
        status: 'active',
        full_name: data.full_name,
        email: data.username.includes('@') ? data.username : null,
        created_at: serverTimestamp()
      };
      
      await setDoc(userRef, user);
      return { id: userId, ...user } as User;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'users');
      throw error;
    }
  },
  loginWithEmail: async (emailOrUsername: string, password: string): Promise<User> => {
    try {
      // First try to find user by username
      let q = query(collection(db, 'users'), where('username', '==', emailOrUsername));
      let snapshot = await getDocs(q);
      
      // If not found by username, try email
      if (snapshot.empty) {
        q = query(collection(db, 'users'), where('email', '==', emailOrUsername));
        snapshot = await getDocs(q);
      }
      
      if (!snapshot.empty) {
        const userDoc = snapshot.docs[0];
        const userData = userDoc.data();
        
        // Check password
        if (userData.password === password) {
          return { id: userDoc.id, ...userData } as User;
        }
      }

      // If no custom user found or password mismatch, throw error
      throw new Error('Invalid credentials');
    } catch (error) {
      console.error("Login error:", error);
      throw error;
    }
  },
  registerWithEmail: async (data: any) => {
    try {
      // const result = await createUserWithEmailAndPassword(auth, data.email, data.password);
      // const firebaseUser = result.user;
      const userId = crypto.randomUUID();
      const firebaseUser = { uid: userId, email: data.email };
      
      const userRef = doc(db, 'users', firebaseUser.uid);
      
      // Check for pre-authorization
      const isAdmin = firebaseUser.email === 'rameshnathankaruvoolan10@gmail.com';
      const preAuthDoc = await getDoc(doc(db, 'pre_authorized_users', firebaseUser.email!));
      const role = isAdmin ? 'admin' : (preAuthDoc.exists() ? preAuthDoc.data().role : 'public');
      const station_id = preAuthDoc.exists() ? preAuthDoc.data().station_id : null;
      
      const user = {
        username: data.username,
        role,
        station_id,
        status: 'active',
        full_name: data.full_name,
        nic: data.nic,
        address: data.address,
        phone: data.phone,
        email: firebaseUser.email,
        password: data.password, // Storing password is insecure, but required for the existing login logic
        created_at: serverTimestamp()
      };
      
      await setDoc(userRef, user, { merge: true });
      
      // Fetch limits to get the correct limit for the vehicle type
      const limits = await api.getTypeLimits();
      const limit = limits.find(l => l.type === data.vehicle_type) || { fuel_limit: 20, limit_period: 'week' };

      // Create vehicle
      await addDoc(collection(db, 'vehicles'), {
        user_id: firebaseUser.uid,
        id_prefix: data.vehicle_prefix,
        id_number: data.vehicle_number,
        type: data.vehicle_type,
        fuel_limit: limit.fuel_limit,
        limit_period: limit.limit_period,
        qr_code: `NPFP-${firebaseUser.uid}-${data.vehicle_number}`,
        status: 'active'
      });
      return { id: firebaseUser.uid, ...user } as User;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'users');
      throw error;
    }
  },
  login: async (): Promise<User> => {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const firebaseUser = result.user;
      
      const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
      
      if (!userDoc.exists()) {
        // Throw error to trigger completion flow
        throw { code: 'auth/user-not-found', user: firebaseUser, message: 'User not registered' };
      }
      
      return { id: userDoc.id, ...userDoc.data() } as User;
    } catch (error: any) {
      console.error("[Login] Error:", error);
      throw error;
    }
  },
  completeGoogleRegistration: async (firebaseUser: any, data: any) => {
    try {
      const userRef = doc(db, 'users', firebaseUser.uid);
      
      // Check for pre-authorization
      const isAdmin = firebaseUser.email === 'rameshnathankaruvoolan10@gmail.com';
      const preAuthDoc = await getDoc(doc(db, 'pre_authorized_users', firebaseUser.email!));
      const role = isAdmin ? 'admin' : (preAuthDoc.exists() ? preAuthDoc.data().role : 'public');
      const station_id = preAuthDoc.exists() ? preAuthDoc.data().station_id : null;
      
      const user = {
        username: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'user',
        role,
        station_id,
        status: 'active',
        full_name: data.full_name,
        nic: data.nic,
        address: data.address,
        phone: data.phone,
        email: firebaseUser.email,
        created_at: serverTimestamp()
      };
      
      await setDoc(userRef, user);
      
      // Fetch limits to get the correct limit for the vehicle type
      const limits = await api.getTypeLimits();
      const limit = limits.find(l => l.type === data.vehicle_type) || { fuel_limit: 20, limit_period: 'week' };

      // Create vehicle
      await addDoc(collection(db, 'vehicles'), {
        user_id: firebaseUser.uid,
        id_prefix: data.vehicle_prefix,
        id_number: data.vehicle_number,
        type: data.vehicle_type,
        fuel_limit: limit.fuel_limit,
        limit_period: limit.limit_period,
        qr_code: `NPFP-${firebaseUser.uid}-${data.vehicle_number}`,
        status: 'active'
      });
      
      return { id: firebaseUser.uid, ...user } as User;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'users');
      throw error;
    }
  },
  searchVehicles: async (q: string): Promise<Vehicle[]> => {
    try {
      const snapshot = await getDocs(collection(db, 'vehicles'));
      const vehicles = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Vehicle));
      return vehicles.filter(v => 
        v.id_prefix.toLowerCase().includes(q.toLowerCase()) || 
        v.id_number.toLowerCase().includes(q.toLowerCase())
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'vehicles');
      return [];
    }
  },
  getVehicleHistory: async (id: string): Promise<FuelTransaction[]> => {
    try {
      const qry = query(collection(db, 'transactions'), where('vehicle_id', '==', id), orderBy('timestamp', 'desc'));
      const snapshot = await getDocs(qry);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FuelTransaction));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'transactions');
      return [];
    }
  },
  getStations: async (): Promise<FuelStation[]> => {
    try {
      const snapshot = await getDocs(collection(db, 'stations'));
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FuelStation));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'stations');
      return [];
    }
  },
  getUsers: async (): Promise<User[]> => {
    try {
      const snapshot = await getDocs(collection(db, 'users'));
      const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
      
      const preAuthSnapshot = await getDocs(collection(db, 'pre_authorized_users'));
      const preAuthUsers = preAuthSnapshot.docs.map(doc => ({
        id: doc.id,
        email: doc.id,
        username: doc.id.split('@')[0],
        role: doc.data().role,
        station_id: doc.data().station_id,
        status: 'pending',
        created_at: doc.data().created_at
      } as User));
      
      const userEmails = new Set(users.map(u => u.email));
      const pendingUsers = preAuthUsers.filter(u => !userEmails.has(u.email));
      
      return [...users, ...pendingUsers];
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'users');
      return [];
    }
  },
  getVehicles: async (): Promise<Vehicle[]> => {
    try {
      const snapshot = await getDocs(collection(db, 'vehicles'));
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Vehicle));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'vehicles');
      return [];
    }
  },
  getAgentTransactions: async (id: string): Promise<FuelTransaction[]> => {
    try {
      const qry = query(collection(db, 'transactions'), where('agent_id', '==', id), orderBy('timestamp', 'desc'));
      const snapshot = await getDocs(qry);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FuelTransaction));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'transactions');
      return [];
    }
  },
  createTransaction: async (data: any) => {
    try {
      return await runTransaction(db, async (transaction) => {
        const stationRef = doc(db, 'stations', data.station_id);
        const stationDoc = await transaction.get(stationRef);
        if (!stationDoc.exists()) throw new Error('Station not found');
        
        const fuelTypeKey = data.fuel_type.toLowerCase().replace(' ', '_');
        const balanceField = `balance_${fuelTypeKey}`;
        const currentBalance = stationDoc.data()[balanceField] || 0;
        
        if (currentBalance < data.amount) {
          throw new Error('Insufficient fuel balance at station');
        }
        
        const transactionRef = doc(collection(db, 'transactions'));
        transaction.set(transactionRef, {
          ...data,
          timestamp: new Date().toISOString()
        });
        
        transaction.update(stationRef, {
          [balanceField]: increment(-data.amount)
        });
        
        // Add audit log
        const logRef = doc(collection(db, 'audit_logs'));
        transaction.set(logRef, {
          transaction_id: transactionRef.id,
          user_id: data.agent_id,
          action: 'create_transaction',
          new_value: JSON.stringify(data),
          timestamp: new Date().toISOString()
        });
        
        return { id: transactionRef.id };
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'transactions');
      throw error;
    }
  },
  updateTransaction: async (id: string, data: any) => {
    try {
      const ref = doc(db, 'transactions', id);
      await updateDoc(ref, data);
      return { id };
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `transactions/${id}`);
      throw error;
    }
  },
  getAuditLogs: async (): Promise<AuditLog[]> => {
    try {
      const snapshot = await getDocs(query(collection(db, 'audit_logs'), orderBy('timestamp', 'desc')));
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AuditLog));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'audit_logs');
      return [];
    }
  },
  getSummary: async () => {
    try {
      const stations = await api.getStations();
      const transactions = await getDocs(collection(db, 'transactions'));
      const totalFuel = transactions.docs.reduce((acc, doc) => acc + (doc.data().amount || 0), 0);
      const users = await api.getUsers();
      return {
        totalStations: stations.length,
        totalFuelPumped: totalFuel,
        activeUsers: users.filter(u => u.status === 'active').length
      };
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, 'summary');
      return { totalStations: 0, totalFuelPumped: 0, activeUsers: 0 };
    }
  },
  getTypeLimits: async (): Promise<VehicleTypeLimit[]> => {
    try {
      const snapshot = await getDocs(collection(db, 'vehicle_type_limits'));
      return snapshot.docs.map(doc => ({ type: doc.id, ...doc.data() } as VehicleTypeLimit));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'vehicle_type_limits');
      return [];
    }
  },
  updateTypeLimit: async (type: string, fuel_limit: number, limit_period: string) => {
    try {
      const sanitizedType = type.replace(/\//g, '-');
      const ref = doc(db, 'vehicle_type_limits', sanitizedType);
      await setDoc(ref, { fuel_limit, limit_period }, { merge: true });
      return { type: sanitizedType };
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `vehicle_type_limits/${type}`);
      throw error;
    }
  },
  createTypeLimit: async (type: string, fuel_limit: number, limit_period: string) => {
    try {
      const sanitizedType = type.replace(/\//g, '-');
      const ref = doc(db, 'vehicle_type_limits', sanitizedType);
      await setDoc(ref, { fuel_limit, limit_period });
      return { type: sanitizedType };
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `vehicle_type_limits/${type}`);
      throw error;
    }
  },
  getDetailedTransactions: async (filters?: any): Promise<FuelTransaction[]> => {
    try {
      let qry = query(collection(db, 'transactions'), orderBy('timestamp', 'desc'));
      if (filters?.station_id) qry = query(qry, where('station_id', '==', filters.station_id));
      const snapshot = await getDocs(qry);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FuelTransaction));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'transactions');
      return [];
    }
  },
  getStationReports: async (filters?: any): Promise<any[]> => {
    try {
      const stations = await api.getStations();
      const transactions = await api.getDetailedTransactions(filters);
      return stations.map(s => ({
        ...s,
        transactionCount: transactions.filter(t => t.station_id === s.id).length,
        totalAmount: transactions.filter(t => t.station_id === s.id).reduce((acc, t) => acc + t.amount, 0)
      }));
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, 'station_reports');
      return [];
    }
  },
  getStationDistributions: async (filters?: any): Promise<FuelDistribution[]> => {
    try {
      const snapshot = await getDocs(query(collection(db, 'distributions'), orderBy('timestamp', 'desc')));
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FuelDistribution));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'distributions');
      return [];
    }
  },
  getAnalytics: async (): Promise<any> => {
    try {
      const transactions = await api.getDetailedTransactions();
      const stations = await api.getStations();
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const todayFuel = transactions
        .filter(t => new Date(t.timestamp) >= today)
        .reduce((acc, t) => acc + t.amount, 0);
        
      const fuelPerStation = stations.map(s => ({
        name: s.name,
        total: transactions.filter(t => t.station_id === s.id).reduce((acc, t) => acc + t.amount, 0)
      })).filter(s => s.total > 0);
      
      const hours = Array.from({ length: 24 }, (_, i) => ({ hour: i, count: 0 }));
      transactions.forEach(t => {
        const hour = new Date(t.timestamp).getHours();
        hours[hour].count += 1;
      });
      const peakHours = hours.filter(h => h.count > 0);
      
      const trendsMap = new Map();
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      transactions
        .filter(t => new Date(t.timestamp) >= thirtyDaysAgo)
        .forEach(t => {
          const dateStr = new Date(t.timestamp).toLocaleDateString();
          trendsMap.set(dateStr, (trendsMap.get(dateStr) || 0) + t.amount);
        });
        
      const trends = Array.from(trendsMap.entries()).map(([date, total]) => ({ date, total }));
      
      const fuelByTypeMap = new Map();
      transactions.forEach(t => {
        fuelByTypeMap.set(t.fuel_type, (fuelByTypeMap.get(t.fuel_type) || 0) + t.amount);
      });
      const fuelByType = Array.from(fuelByTypeMap.entries()).map(([name, value]) => ({ name, value }));

      return { todayFuel, fuelPerStation, peakHours, trends, fuelByType };
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, 'analytics');
      return { todayFuel: 0, fuelPerStation: [], peakHours: [], trends: [], fuelByType: [] };
    }
  },
  addStationFuel: async (stationId: string, amount: number, fuelType: string) => {
    try {
      return await runTransaction(db, async (transaction) => {
        const stationRef = doc(db, 'stations', stationId);
        const fuelTypeKey = fuelType.toLowerCase().replace(' ', '_');
        const balanceField = `balance_${fuelTypeKey}`;
        
        transaction.update(stationRef, {
          [balanceField]: increment(amount)
        });
        
        const distRef = doc(collection(db, 'distributions'));
        transaction.set(distRef, {
          station_id: stationId,
          fuel_type: fuelType,
          amount: amount,
          timestamp: new Date().toISOString()
        });
        
        return { id: distRef.id };
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `stations/${stationId}/add-fuel`);
      throw error;
    }
  },
  getStationBalances: async (): Promise<FuelStation[]> => {
    return await api.getStations();
  },
  createVehicle: async (data: any) => {
    try {
      const ref = await addDoc(collection(db, 'vehicles'), data);
      return { id: ref.id };
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'vehicles');
      throw error;
    }
  },
  createUser: async (data: any) => {
    try {
      const email = data.email;
      const qry = query(collection(db, 'users'), where('email', '==', email));
      const snapshot = await getDocs(qry);
      
      if (!snapshot.empty) {
        const userDoc = snapshot.docs[0];
        await updateDoc(doc(db, 'users', userDoc.id), {
          role: data.role,
          station_id: data.station_id || null
        });
        return { id: userDoc.id };
      } else {
        await setDoc(doc(db, 'pre_authorized_users', email), {
          role: data.role,
          station_id: data.station_id || null,
          created_at: serverTimestamp()
        });
        return { id: email };
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'users');
      throw error;
    }
  },
  getManagerTransactions: async (stationId: string): Promise<FuelTransaction[]> => {
    try {
      const qry = query(collection(db, 'transactions'), where('station_id', '==', stationId), orderBy('timestamp', 'desc'));
      const snapshot = await getDocs(qry);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FuelTransaction));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'transactions');
      return [];
    }
  },
  getAgents: async (): Promise<User[]> => {
    try {
      const qry = query(collection(db, 'users'), where('role', '==', 'agent'));
      const snapshot = await getDocs(qry);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'users');
      return [];
    }
  },
  getManagerAgents: async (stationId: string): Promise<User[]> => {
    try {
      const qry = query(collection(db, 'users'), where('station_id', '==', stationId), where('role', '==', 'agent'));
      const snapshot = await getDocs(qry);
      const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
      
      const preAuthQry = query(collection(db, 'pre_authorized_users'), where('station_id', '==', stationId), where('role', '==', 'agent'));
      const preAuthSnapshot = await getDocs(preAuthQry);
      const preAuthUsers = preAuthSnapshot.docs.map(doc => ({
        id: doc.id,
        email: doc.id,
        username: doc.id.split('@')[0],
        role: doc.data().role,
        station_id: doc.data().station_id,
        status: 'pending',
        created_at: doc.data().created_at
      } as User));
      
      // Merge and remove duplicates (prefer 'users' over 'pre_authorized_users')
      const userEmails = new Set(users.map(u => u.email));
      const pendingUsers = preAuthUsers.filter(u => !userEmails.has(u.email));
      
      return [...users, ...pendingUsers];
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'users');
      return [];
    }
  },
  createManagerAgent: async (stationId: string, data: any) => {
    return await api.createUser({ ...data, role: 'agent', station_id: stationId });
  },
  createStation: async (data: any) => {
    try {
      const ref = await addDoc(collection(db, 'stations'), {
        ...data,
        balance_petrol_92: 0,
        balance_petrol_95: 0,
        balance_diesel: 0,
        balance_super_diesel: 0
      });
      return { id: ref.id };
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'stations');
      throw error;
    }
  },

  deleteUser: async (userId: string) => {
    try {
      await deleteDoc(doc(db, 'users', userId));
      return { id: userId };
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${userId}`);
      throw error;
    }
  },
  updateUser: async (userId: string, data: any) => {
    try {
      await updateDoc(doc(db, 'users', userId), data);
      return { id: userId };
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
      throw error;
    }
  },
  deleteStation: async (stationId: string) => {
    try {
      await deleteDoc(doc(db, 'stations', stationId));
      return { id: stationId };
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `stations/${stationId}`);
      throw error;
    }
  },
  updateStation: async (stationId: string, data: any) => {
    try {
      await updateDoc(doc(db, 'stations', stationId), data);
      return { id: stationId };
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `stations/${stationId}`);
      throw error;
    }
  },
  getMyVehicle: async (userId: string): Promise<Vehicle | null> => {
    try {
      const qry = query(collection(db, 'vehicles'), where('user_id', '==', userId), limit(1));
      const snapshot = await getDocs(qry);
      if (snapshot.empty) return null;
      return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Vehicle;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `vehicles/user/${userId}`);
      return null;
    }
  }
};

const VEHICLE_TYPES: VehicleType[] = ['Car', 'Motorcycle / Bike', 'Three-Wheeler / Auto Rickshaw', 'Truck', 'Bus', 'Other'];

function RegisterView({ onBack, onSuccess }: { onBack: () => void, onSuccess: () => void }) {
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    password: '',
    full_name: '',
    nic: '',
    address: '',
    phone: '',
    vehicle_prefix: '',
    vehicle_number: '',
    vehicle_type: 'Car' as VehicleType
  });
  const [msg, setMsg] = useState({ text: '', type: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.registerWithEmail(formData);
      setMsg({ text: 'Registration successful! You can now login.', type: 'success' });
      setTimeout(onSuccess, 2000);
    } catch (err: any) {
      setMsg({ text: getErrorMessage(err), type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleRegister = async () => {
    setLoading(true);
    try {
      await api.login();
      // If login succeeds (user exists), we just redirect to login/dashboard
      // If user is new, api.login throws auth/user-not-found, caught below
      setMsg({ text: 'Registration successful! You can now login.', type: 'success' });
      setTimeout(onSuccess, 2000);
    } catch (err: any) {
      if (err.code === 'auth/user-not-found') {
        // This is expected for new users, App.tsx will handle the redirect to CompleteProfileView
        return;
      }
      setMsg({ text: getErrorMessage(err), type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-12">
      <div className="bg-white rounded-[2.5rem] shadow-xl overflow-hidden">
        <div className="p-10">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-3xl font-bold">New User Registration</h2>
            <button onClick={onBack} className="text-sm font-bold opacity-40 hover:opacity-100 transition-opacity">Back to Login</button>
          </div>

          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {msg.text && (
              <div className={`md:col-span-2 p-4 rounded-2xl text-sm flex items-center gap-3 ${msg.type === 'success' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                {msg.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                {msg.text}
              </div>
            )}

            <div className="space-y-2 md:col-span-2">
              <label className="text-xs font-bold uppercase tracking-widest opacity-40 ml-4">Username</label>
              <div className="relative">
                <UserIcon className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 opacity-20" />
                <input 
                  type="text" required
                  className="w-full pl-14 pr-6 py-4 bg-[#F5F5F0] rounded-2xl outline-none"
                  value={formData.username}
                  onChange={e => setFormData({...formData, username: e.target.value})}
                />
              </div>
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-xs font-bold uppercase tracking-widest opacity-40 ml-4">Email Address</label>
              <div className="relative">
                <UserIcon className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 opacity-20" />
                <input 
                  type="email" required
                  className="w-full pl-14 pr-6 py-4 bg-[#F5F5F0] rounded-2xl outline-none"
                  value={formData.email}
                  onChange={e => setFormData({...formData, email: e.target.value})}
                />
              </div>
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-xs font-bold uppercase tracking-widest opacity-40 ml-4">Password</label>
              <div className="relative">
                <Shield className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 opacity-20" />
                <input 
                  type="password" required minLength={6}
                  className="w-full pl-14 pr-6 py-4 bg-[#F5F5F0] rounded-2xl outline-none"
                  value={formData.password}
                  onChange={e => setFormData({...formData, password: e.target.value})}
                />
              </div>
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-xs font-bold uppercase tracking-widest opacity-40 ml-4">Full Name</label>
              <div className="relative">
                <UserIcon className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 opacity-20" />
                <input 
                  type="text" required
                  className="w-full pl-14 pr-6 py-4 bg-[#F5F5F0] rounded-2xl outline-none"
                  value={formData.full_name}
                  onChange={e => setFormData({...formData, full_name: e.target.value})}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest opacity-40 ml-4">NIC Number</label>
              <div className="relative">
                <CreditCard className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 opacity-20" />
                <input 
                  type="text" required
                  className="w-full pl-14 pr-6 py-4 bg-[#F5F5F0] rounded-2xl outline-none"
                  value={formData.nic}
                  onChange={e => setFormData({...formData, nic: e.target.value})}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest opacity-40 ml-4">Phone Number</label>
              <div className="relative">
                <Phone className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 opacity-20" />
                <input 
                  type="tel" required
                  className="w-full pl-14 pr-6 py-4 bg-[#F5F5F0] rounded-2xl outline-none"
                  value={formData.phone}
                  onChange={e => setFormData({...formData, phone: e.target.value})}
                />
              </div>
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-xs font-bold uppercase tracking-widest opacity-40 ml-4">Address</label>
              <div className="relative">
                <Home className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 opacity-20" />
                <textarea 
                  required
                  className="w-full pl-14 pr-6 py-4 bg-[#F5F5F0] rounded-2xl outline-none min-h-[100px]"
                  value={formData.address}
                  onChange={e => setFormData({...formData, address: e.target.value})}
                />
              </div>
            </div>

            <div className="md:col-span-2 border-t border-[#141414]/5 pt-6 mt-2">
              <h3 className="text-lg font-bold mb-4">Vehicle Details</h3>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest opacity-40 ml-4">Vehicle Prefix (e.g. WP AAA)</label>
              <input 
                type="text" required
                className="w-full px-6 py-4 bg-[#F5F5F0] rounded-2xl outline-none"
                value={formData.vehicle_prefix}
                onChange={e => setFormData({...formData, vehicle_prefix: e.target.value})}
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest opacity-40 ml-4">Vehicle Number (e.g. 9346)</label>
              <input 
                type="text" required
                className="w-full px-6 py-4 bg-[#F5F5F0] rounded-2xl outline-none"
                value={formData.vehicle_number}
                onChange={e => setFormData({...formData, vehicle_number: e.target.value})}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-xs font-bold uppercase tracking-widest opacity-40 ml-4">Vehicle Type</label>
              <select 
                className="w-full px-6 py-4 bg-[#F5F5F0] rounded-2xl outline-none appearance-none"
                value={formData.vehicle_type}
                onChange={e => setFormData({...formData, vehicle_type: e.target.value as VehicleType})}
              >
                {VEHICLE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div className="md:col-span-2 space-y-4">
              <button 
                type="submit" 
                disabled={loading}
                className="w-full py-5 bg-[#141414] text-white rounded-2xl font-bold text-lg hover:bg-opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-3"
              >
                <UserIcon className="w-5 h-5" />
                {loading ? 'Registering...' : 'Register with Email'}
              </button>
              
              <div className="relative flex items-center justify-center">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-[#141414]/10"></div>
                </div>
                <div className="relative bg-white px-4 text-sm text-[#141414]/40 font-bold uppercase tracking-widest">Or</div>
              </div>

              <button 
                type="button"
                onClick={handleGoogleRegister}
                disabled={loading}
                className="w-full py-5 bg-white border border-[#141414]/10 text-[#141414] rounded-2xl font-bold text-lg hover:bg-[#F5F5F0] transition-all disabled:opacity-50 flex items-center justify-center gap-3"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                  <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Sign up with Google
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function CompleteProfileView({ user, onSuccess, onCancel }: { user: any, onSuccess: (user: User) => void, onCancel: () => void }) {
  const [formData, setFormData] = useState({
    full_name: user.displayName || '',
    nic: '',
    address: '',
    phone: '',
    vehicle_prefix: '',
    vehicle_number: '',
    vehicle_type: 'Car' as VehicleType
  });
  const [msg, setMsg] = useState({ text: '', type: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const newUser = await api.completeGoogleRegistration(user, formData);
      setMsg({ text: 'Profile completed! Logging you in...', type: 'success' });
      setTimeout(() => onSuccess(newUser), 1500);
    } catch (err: any) {
      setMsg({ text: getErrorMessage(err), type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-12">
      <div className="bg-white rounded-[2.5rem] shadow-xl overflow-hidden">
        <div className="p-10">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-3xl font-bold">Complete Your Profile</h2>
            <button onClick={onCancel} className="text-sm font-bold opacity-40 hover:opacity-100 transition-opacity">Cancel</button>
          </div>
          
          <div className="mb-6 p-4 bg-blue-50 text-blue-700 rounded-2xl text-sm">
            Please provide your vehicle and personal details to complete registration for <strong>{user.email}</strong>.
          </div>

          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {msg.text && (
              <div className={`md:col-span-2 p-4 rounded-2xl text-sm flex items-center gap-3 ${msg.type === 'success' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                {msg.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                {msg.text}
              </div>
            )}

            <div className="space-y-2 md:col-span-2">
              <label className="text-xs font-bold uppercase tracking-widest opacity-40 ml-4">Full Name</label>
              <input 
                type="text" required
                className="w-full px-6 py-4 bg-[#F5F5F0] rounded-2xl outline-none"
                value={formData.full_name}
                onChange={e => setFormData({...formData, full_name: e.target.value})}
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest opacity-40 ml-4">NIC Number</label>
              <input 
                type="text" required
                className="w-full px-6 py-4 bg-[#F5F5F0] rounded-2xl outline-none"
                value={formData.nic}
                onChange={e => setFormData({...formData, nic: e.target.value})}
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest opacity-40 ml-4">Phone Number</label>
              <input 
                type="tel" required
                className="w-full px-6 py-4 bg-[#F5F5F0] rounded-2xl outline-none"
                value={formData.phone}
                onChange={e => setFormData({...formData, phone: e.target.value})}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-xs font-bold uppercase tracking-widest opacity-40 ml-4">Address</label>
              <input 
                type="text" required
                className="w-full px-6 py-4 bg-[#F5F5F0] rounded-2xl outline-none"
                value={formData.address}
                onChange={e => setFormData({...formData, address: e.target.value})}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-xs font-bold uppercase tracking-widest opacity-40 ml-4">Vehicle Type</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {VEHICLE_TYPES.map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setFormData({...formData, vehicle_type: type})}
                    className={`p-4 rounded-2xl text-sm font-bold transition-all ${formData.vehicle_type === type ? 'bg-[#141414] text-white shadow-lg scale-105' : 'bg-[#F5F5F0] hover:bg-gray-200'}`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest opacity-40 ml-4">Vehicle Prefix (e.g. WP ABC)</label>
              <input 
                type="text" required
                className="w-full px-6 py-4 bg-[#F5F5F0] rounded-2xl outline-none uppercase"
                placeholder="WP ABC"
                value={formData.vehicle_prefix}
                onChange={e => setFormData({...formData, vehicle_prefix: e.target.value.toUpperCase()})}
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest opacity-40 ml-4">Vehicle Number (e.g. 1234)</label>
              <input 
                type="text" required
                className="w-full px-6 py-4 bg-[#F5F5F0] rounded-2xl outline-none"
                placeholder="1234"
                value={formData.vehicle_number}
                onChange={e => setFormData({...formData, vehicle_number: e.target.value})}
              />
            </div>

            <div className="md:col-span-2 pt-4">
              <button 
                type="submit"
                disabled={loading}
                className="w-full py-5 bg-[#141414] text-white rounded-2xl font-bold text-lg hover:bg-opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-3"
              >
                {loading ? 'Completing Registration...' : 'Complete Registration'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function PublicDashboard({ user }: { user: User }) {
  const [vehicle, setVehicle] = useState<Vehicle | null>(user.vehicle || null);
  const [history, setHistory] = useState<FuelTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const v = await api.getMyVehicle(user.id);
      setVehicle(v);
      if (v) {
        const h = await api.getVehicleHistory(v.id);
        setHistory(h);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#141414]"></div></div>;

  if (!vehicle) return (
    <div className="text-center py-20 space-y-4">
      <AlertCircle className="w-16 h-16 mx-auto opacity-20" />
      <h2 className="text-2xl font-bold">No Vehicle Found</h2>
      <p className="opacity-50">Please contact administrator to link a vehicle to your account.</p>
    </div>
  );

  const totalConsumed = history.reduce((sum, t) => sum + t.amount, 0);
  const remaining = Math.max(0, vehicle.fuel_limit - totalConsumed);

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white/70 backdrop-blur-xl p-10 rounded-[2.5rem] border border-white/40 shadow-xl shadow-black/5">
            <div className="flex justify-between items-start mb-10">
              <div>
                <p className="text-[10px] uppercase tracking-widest font-bold opacity-40 mb-2">Vehicle Details</p>
                <h2 className="text-4xl font-bold tracking-tight">{vehicle.id_prefix} {vehicle.id_number}</h2>
                <p className="text-lg opacity-60 mt-2">{vehicle.type}</p>
              </div>
              <div className="bg-[#141414] text-white px-6 py-3 rounded-2xl">
                <p className="text-[10px] uppercase tracking-widest font-bold opacity-50 mb-1">Weekly Quota</p>
                <p className="text-2xl font-bold">{vehicle.fuel_limit}L</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="bg-white/40 p-8 rounded-3xl">
                <p className="text-[10px] uppercase tracking-widest font-bold opacity-40 mb-2">Remaining</p>
                <p className="text-4xl font-bold text-green-600">{remaining.toFixed(1)}L</p>
              </div>
              <div className="bg-white/40 p-8 rounded-3xl">
                <p className="text-[10px] uppercase tracking-widest font-bold opacity-40 mb-2">Consumed</p>
                <p className="text-4xl font-bold">{totalConsumed.toFixed(1)}L</p>
              </div>
            </div>
          </div>

          <div className="bg-white/70 backdrop-blur-xl rounded-[2.5rem] border border-white/40 shadow-xl shadow-black/5 overflow-hidden">
            <div className="p-8 border-b border-[#141414]/5 flex justify-between items-center">
              <h3 className="text-xl font-bold flex items-center gap-3">
                <History className="w-5 h-5 opacity-30" />
                Recent Transactions
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-[#F5F5F0]/50 text-[10px] uppercase tracking-widest font-bold opacity-50">
                    <th className="px-8 py-4">Date & Time</th>
                    <th className="px-8 py-4">Station</th>
                    <th className="px-8 py-4 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#141414]/5">
                  {history.map(t => (
                    <tr key={t.id} className="hover:bg-[#F5F5F0]/30 transition-colors">
                      <td className="px-8 py-4 text-sm">{new Date(t.timestamp).toLocaleString()}</td>
                      <td className="px-8 py-4 text-sm font-medium">{t.station_name}</td>
                      <td className="px-8 py-4 text-sm font-bold text-right">{t.amount}L</td>
                    </tr>
                  ))}
                  {history.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-8 py-12 text-center opacity-30 italic">No transactions found</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="space-y-8">
          <div className="bg-white/70 backdrop-blur-xl p-10 rounded-[2.5rem] border border-white/40 shadow-xl shadow-black/5 text-center">
            <p className="text-[10px] uppercase tracking-widest font-bold opacity-40 mb-6">Your Fuel Pass QR</p>
            <div className="bg-white/50 p-8 rounded-3xl inline-block mb-6">
              <QRCodeCanvas 
                value={JSON.stringify({ vehicleId: vehicle.id, prefix: vehicle.id_prefix, number: vehicle.id_number })} 
                size={200}
                level="H"
                includeMargin={true}
              />
            </div>
            <p className="text-sm opacity-60 mb-6">Present this QR code at any fuel station to pump fuel.</p>
            <button 
              className="w-full py-4 bg-[#141414] text-white rounded-2xl font-bold hover:bg-opacity-90 transition-all"
              onClick={() => alert('Google Wallet integration is coming soon!')}
            >
              Add to Google Wallet
            </button>
          </div>

          <div className="bg-[#141414] text-white p-10 rounded-[2.5rem] shadow-xl">
            <h3 className="text-xl font-bold mb-6">Profile Info</h3>
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                  <UserIcon className="w-5 h-5 opacity-50" />
                </div>
                <div>
                  <p className="text-[10px] uppercase opacity-40 font-bold">Full Name</p>
                  <p className="font-medium">{user.full_name}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                  <CreditCard className="w-5 h-5 opacity-50" />
                </div>
                <div>
                  <p className="text-[10px] uppercase opacity-40 font-bold">NIC Number</p>
                  <p className="font-medium">{user.nic}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                  <Phone className="w-5 h-5 opacity-50" />
                </div>
                <div>
                  <p className="text-[10px] uppercase opacity-40 font-bold">Phone</p>
                  <p className="font-medium">{user.phone}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function QRScanner({ onScan, onCancel }: { onScan: (data: any) => void, onCancel: () => void }) {
  useEffect(() => {
    const scanner = new Html5QrcodeScanner(
      "reader", 
      { fps: 10, qrbox: { width: 250, height: 250 } },
      /* verbose= */ false
    );

    scanner.render((decodedText) => {
      try {
        const data = JSON.parse(decodedText);
        scanner.clear();
        onScan(data);
      } catch (e) {
        console.error("Invalid QR code", e);
      }
    }, (error) => {
      // console.warn(error);
    });

    return () => {
      scanner.clear().catch(e => console.error("Failed to clear scanner", e));
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-[#141414]/80 backdrop-blur-md">
      <div className="bg-white w-full max-w-md rounded-[2.5rem] overflow-hidden">
        <div className="p-8 border-b border-[#141414]/5 flex justify-between items-center">
          <h3 className="text-xl font-bold">Scan Fuel Pass</h3>
          <button onClick={onCancel} className="p-2 hover:bg-[#F5F5F0] rounded-full"><XCircle className="w-6 h-6 opacity-30" /></button>
        </div>
        <div id="reader" className="w-full"></div>
        <div className="p-8 text-center text-sm opacity-50">
          Position the QR code within the frame to scan.
        </div>
      </div>
    </div>
  );
}

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean, error: Error | null }> {
  state = { hasError: false, error: null as Error | null };

  constructor(props: { children: ReactNode }) {
    super(props);
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      let errorMessage = "An unexpected error occurred.";
      try {
        if (this.state.error?.message) {
          const parsed = JSON.parse(this.state.error.message);
          if (parsed.error) {
            errorMessage = parsed.error;
          }
        }
      } catch (e) {
        errorMessage = this.state.error?.message || errorMessage;
      }

      return (
        <div className="min-h-screen bg-[#F5F5F0] flex items-center justify-center p-6">
          <div className="bg-white/70 backdrop-blur-xl p-10 rounded-[2.5rem] border border-white/40 shadow-xl shadow-black/5 max-w-md w-full text-center">
            <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="text-red-600 w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight mb-2">Something went wrong</h2>
            <p className="text-red-600 text-sm mb-6">{errorMessage}</p>
            <button 
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-[#141414] text-white rounded-full font-bold w-full"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function AppWrapper() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}

const useAsyncError = () => {
  const [_, setError] = useState();
  return useCallback(
    (e: Error) => {
      setError(() => {
        throw e;
      });
    },
    [setError],
  );
};

function App() {
  const throwError = useAsyncError();
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<Role | 'login' | 'register' | 'complete-profile'>('public');
  const [pendingGoogleUser, setPendingGoogleUser] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Vehicle[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [vehicleHistory, setVehicleHistory] = useState<FuelTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const loggedInUser = await api.loginWithEmail(email, password);
      setUser(loggedInUser);
      setView(loggedInUser.role);
    } catch (err: any) {
      console.error("Login error:", err);
      setError(getErrorMessage(err) || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Check for custom session first
    const storedUser = localStorage.getItem('fuelpass_user');
    if (storedUser) {
      try {
        const userData = JSON.parse(storedUser);
        setUser(userData);
        setView(userData.role);
        setIsAuthReady(true);
        return; // Skip Firebase auth check if local session exists
      } catch (e) {
        localStorage.removeItem('fuelpass_user');
      }
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            const userData = { id: userDoc.id, ...userDoc.data() } as User;
            setUser(userData);
            setView(userData.role);
          } else {
            // User authenticated but no profile found -> Needs to complete registration
            setPendingGoogleUser(firebaseUser);
            setView('complete-profile');
          }
        } catch (e) {
          console.error("Error fetching user data:", e);
          try {
            handleFirestoreError(e, OperationType.GET, `users/${firebaseUser.uid}`);
          } catch (err: any) {
            throwError(err);
          }
        }
      } else {
        // Only clear user if no local session (handled at start of effect)
        if (!localStorage.getItem('fuelpass_user')) {
          setUser(null);
          setView('public');
        }
      }
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, [throwError]);

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const loggedInUser = await api.loginWithEmail(email, password);
      setUser(loggedInUser);
      setView(loggedInUser.role);
      // Persist custom session
      localStorage.setItem('fuelpass_user', JSON.stringify(loggedInUser));
    } catch (err: any) {
      console.error("Login error:", err);
      setError(getErrorMessage(err) || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      await api.login();
    } catch (err: any) {
      if (err.code === 'auth/user-not-found') {
        return;
      }
      console.error("Google login error:", err);
      setError(getErrorMessage(err));
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    localStorage.removeItem('fuelpass_user');
    setUser(null);
    setView('public');
  };

  const handleSearch = async () => {
    if (!searchQuery) return;
    setLoading(true);
    try {
      const results = await api.searchVehicles(searchQuery);
      setSearchResults(results);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const selectVehicle = async (v: Vehicle) => {
    setSelectedVehicle(v);
    try {
      const history = await api.getVehicleHistory(v.id);
      setVehicleHistory(history);
    } catch (error) {
      console.error(error);
    }
  };

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-[#F5F5F0] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[#141414] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen relative font-sans">
      <div className="liquid-bg" />
      {/* Navigation */}
      <nav className="glass-nav px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => setView('public')}>
          <div className="bg-[#141414] p-2 rounded-lg">
            <Fuel className="text-white w-6 h-6" />
          </div>
          <div>
            <h1 className="font-bold text-lg tracking-tight leading-none">NP Fuel Pass</h1>
            <p className="text-[10px] uppercase tracking-widest opacity-50 font-semibold mt-1">Northern Province</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          {user ? (
            <div className="flex items-center gap-4">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold">{user.username}</p>
                <p className="text-[10px] uppercase opacity-50 font-bold">{user.role} {user.station_name ? `• ${user.station_name}` : ''}</p>
              </div>
              <button 
                onClick={handleLogout}
                className="p-2 hover:bg-red-50 text-red-600 rounded-full transition-colors"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <button 
              onClick={() => setView('login')}
              className="px-4 py-2 bg-[#141414] text-white rounded-full text-sm font-bold hover:bg-opacity-90 transition-all flex items-center gap-2"
            >
              <Shield className="w-4 h-4" />
              Staff Login
            </button>
          )}
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-6">
        <AnimatePresence mode="wait">
          {view === 'public' && (
            <motion.div 
              key="public"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              {user?.role === 'public' ? (
                <PublicDashboard user={user} />
              ) : (
                <div className="space-y-16 py-12">
                  <div className="text-center space-y-8">
                    <div className="max-w-3xl mx-auto space-y-6">
                      <h2 className="text-5xl font-bold tracking-tight">Fuel Pass Northern Province</h2>
                      <p className="text-xl opacity-60 leading-relaxed">
                        Securely manage your fuel quota, view transaction history, and get your unique QR code for seamless pumping at any station.
                      </p>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-8">
                      <button 
                        onClick={() => setView('login')}
                        className="px-10 py-5 bg-[#141414] text-white rounded-2xl font-bold text-lg hover:bg-opacity-90 transition-all shadow-xl shadow-[#141414]/20 flex items-center gap-3"
                      >
                        <Shield className="w-6 h-6" />
                        Login to Dashboard
                      </button>
                      <button 
                        onClick={() => setView('register' as any)}
                        className="px-10 py-5 bg-white text-[#141414] border border-[#141414]/10 rounded-2xl font-bold text-lg hover:bg-[#F5F5F0] transition-all flex items-center gap-3"
                      >
                        <Plus className="w-6 h-6" />
                        Register New Vehicle
                      </button>
                    </div>
                  </div>

                  <div className="space-y-8">
                    <div className="flex items-center gap-4">
                      <div className="h-px flex-1 bg-[#141414]/5" />
                      <h3 className="text-sm font-bold uppercase tracking-[0.2em] opacity-30">Station Fuel Availability</h3>
                      <div className="h-px flex-1 bg-[#141414]/5" />
                    </div>
                    <PublicStationBalances />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-8 max-w-5xl mx-auto">
                    <div className="bg-white p-8 rounded-3xl border border-[#141414]/5 text-left space-y-4">
                      <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
                        <QrCode className="w-6 h-6" />
                      </div>
                      <h3 className="font-bold text-lg">Unique QR Code</h3>
                      <p className="text-sm opacity-50">Get a unique QR code for your vehicle to speed up the pumping process.</p>
                    </div>
                    <div className="bg-white p-8 rounded-3xl border border-[#141414]/5 text-left space-y-4">
                      <div className="w-12 h-12 bg-green-50 text-green-600 rounded-2xl flex items-center justify-center">
                        <BarChart3 className="w-6 h-6" />
                      </div>
                      <h3 className="font-bold text-lg">Real-time Quota</h3>
                      <p className="text-sm opacity-50">Track your weekly fuel consumption and remaining balance in real-time.</p>
                    </div>
                    <div className="bg-white p-8 rounded-3xl border border-[#141414]/5 text-left space-y-4">
                      <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center">
                        <History className="w-6 h-6" />
                      </div>
                      <h3 className="font-bold text-lg">Detailed History</h3>
                      <p className="text-sm opacity-50">Access your full transaction history across all registered fuel stations.</p>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {(view as any) === 'register' && (
            <motion.div 
              key="register"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <RegisterView onBack={() => setView('public')} onSuccess={() => setView('login')} />
            </motion.div>
          )}

          {(view as any) === 'complete-profile' && (
            <motion.div 
              key="complete-profile"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <CompleteProfileView 
                user={pendingGoogleUser} 
                onSuccess={(user) => {
                  setUser(user);
                  setView(user.role);
                  setPendingGoogleUser(null);
                }}
                onCancel={() => {
                  setPendingGoogleUser(null);
                  setView('public');
                  auth.signOut();
                }}
              />
            </motion.div>
          )}

          {view === 'login' && (
            <motion.div 
              key="login"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-md mx-auto py-20"
            >
            <div className="bg-white/70 backdrop-blur-xl p-10 rounded-[2.5rem] border border-white/40 shadow-xl shadow-black/5">
                <div className="text-center mb-10">
                  <div className="w-16 h-16 bg-[#141414] rounded-2xl flex items-center justify-center mx-auto mb-6">
                    <Shield className="text-white w-8 h-8" />
                  </div>
                  <h2 className="text-3xl font-bold tracking-tight">Access Portal</h2>
                  <p className="opacity-50 mt-2">Enter your credentials to access the system</p>
                </div>

                <div className="space-y-6">
                  {error && (
                    <div className="p-4 bg-red-50/50 backdrop-blur-md text-red-600 rounded-2xl text-sm flex items-center gap-3">
                      <AlertCircle className="w-5 h-5" />
                      {error}
                    </div>
                  )}

                  <form onSubmit={(e) => { e.preventDefault(); handleLogin(); }} className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-widest opacity-40 ml-4">Username or Email</label>
                      <div className="relative">
                        <UserIcon className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 opacity-20" />
                        <input 
                          type="text" required
                          className="w-full pl-14 pr-6 py-4 bg-[#F5F5F0] rounded-2xl outline-none"
                          value={email}
                          onChange={e => setEmail(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-widest opacity-40 ml-4">Password</label>
                      <div className="relative">
                        <Shield className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 opacity-20" />
                        <input 
                          type="password" required
                          className="w-full pl-14 pr-6 py-4 bg-[#F5F5F0] rounded-2xl outline-none"
                          value={password}
                          onChange={e => setPassword(e.target.value)}
                        />
                      </div>
                    </div>

                    <button 
                      type="submit"
                      disabled={loading}
                      className="w-full py-5 bg-[#141414] text-white rounded-2xl font-bold tracking-tight hover:bg-[#2a2a2a] active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                    >
                      {loading ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <>
                          <UserIcon className="w-5 h-5" />
                          Sign in
                        </>
                      )}
                    </button>
                  </form>
                  
                  <div className="relative flex items-center justify-center">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-[#141414]/10"></div>
                    </div>
                    <div className="relative bg-white px-4 text-sm text-[#141414]/40 font-bold uppercase tracking-widest">Or</div>
                  </div>
                  
                  <button 
                    onClick={handleGoogleLogin}
                    disabled={loading}
                    className="w-full py-5 bg-white border border-[#141414]/10 text-[#141414] rounded-2xl font-bold tracking-tight hover:bg-[#F5F5F0] active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                  >
                    {loading ? (
                      <div className="w-5 h-5 border-2 border-[#141414]/30 border-t-[#141414] rounded-full animate-spin" />
                    ) : (
                      <>
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                          <path
                            fill="currentColor"
                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                          />
                          <path
                            fill="currentColor"
                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                          />
                          <path
                            fill="currentColor"
                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                          />
                          <path
                            fill="currentColor"
                            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                          />
                        </svg>
                        Sign in with Google
                      </>
                    )}
                  </button>
                </div>

                <div className="mt-8 pt-8 border-t border-[#141414]/5 text-center">
                  <p className="text-sm opacity-50 mb-4">Don't have a fuel pass?</p>
                  <button 
                    onClick={() => setView('register' as any)}
                    className="text-sm font-bold hover:underline"
                  >
                    Register your vehicle now →
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {view === 'agent' && user && <AgentDashboard user={user} />}
          {view === 'manager' && user && <ManagerDashboard user={user} />}
          {view === 'admin' && user && <AdminDashboard user={user} />}
        </AnimatePresence>
      </main>
    </div>
  );
}

function StationBalanceWidget({ stationId }: { stationId: string }) {
  const [station, setStation] = useState<FuelStation | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadBalance = async () => {
      const stations = await api.getStationBalances();
      const current = stations.find(s => String(s.id) === String(stationId));
      if (current) setStation(current);
      setLoading(false);
    };
    loadBalance();
    // Refresh every 30 seconds
    const interval = setInterval(loadBalance, 30000);
    return () => clearInterval(interval);
  }, [stationId]);

  if (loading || !station) return null;

  return (
    <div className="bg-[#141414] text-white p-8 rounded-[2.5rem] shadow-xl">
      <div className="flex items-center gap-3 mb-6">
        <Droplets className="w-5 h-5 text-blue-400" />
        <h3 className="text-xl font-bold">Station Fuel Balance</h3>
      </div>
      <div className="grid grid-cols-2 gap-6">
        <div>
          <p className="text-[10px] uppercase tracking-widest font-bold opacity-40 mb-1">Petrol 92</p>
          <p className="text-2xl font-bold">{station.balance_petrol_92.toLocaleString()}L</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-widest font-bold opacity-40 mb-1">Petrol 95</p>
          <p className="text-2xl font-bold">{station.balance_petrol_95.toLocaleString()}L</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-widest font-bold opacity-40 mb-1">Diesel</p>
          <p className="text-2xl font-bold">{station.balance_diesel.toLocaleString()}L</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-widest font-bold opacity-40 mb-1">Super Diesel</p>
          <p className="text-2xl font-bold">{station.balance_super_diesel.toLocaleString()}L</p>
        </div>
      </div>
    </div>
  );
}

function AgentDashboard({ user }: { user: User }) {
  const [transactions, setTransactions] = useState<FuelTransaction[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [formData, setFormData] = useState({
    id_prefix: '',
    id_number: '',
    amount: '',
    fuel_type: 'Petrol 92',
    type: '' // Vehicle type for new registration
  });
  const [quotaInfo, setQuotaInfo] = useState<{ vehicle: Vehicle; consumed: number } | null>(null);
  const [msg, setMsg] = useState({ text: '', type: '' });
  const [typeLimits, setTypeLimits] = useState<VehicleTypeLimit[]>([]);

  const throwError = useAsyncError();

  useEffect(() => {
    loadTransactions().catch(throwError);
    loadTypeLimits().catch(throwError);
  }, [throwError]);

  const loadTransactions = async () => {
    const data = await api.getAgentTransactions(user.id);
    setTransactions(data);
  };

  const loadTypeLimits = async () => {
    const data = await api.getTypeLimits();
    setTypeLimits(data);
  };

  const handleQRScan = (data: any) => {
    setShowScanner(false);
    if (data.prefix && data.number) {
      setFormData({ ...formData, id_prefix: data.prefix, id_number: data.number });
      setShowForm(true);
      // Trigger quota check automatically
      setTimeout(() => {
        checkQuota();
      }, 100);
    }
  };

  const checkQuota = async () => {
    if (!formData.id_prefix || !formData.id_number) {
      setMsg({ text: 'Please enter Vehicle ID prefix and number', type: 'error' });
      return;
    }
    setMsg({ text: '', type: '' });
    try {
      const vehicles = await api.searchVehicles(`${formData.id_prefix}${formData.id_number}`);
      const vehicle = vehicles.find(v => v.id_prefix === formData.id_prefix && v.id_number === formData.id_number);
      
      if (vehicle) {
        const history = await api.getVehicleHistory(vehicle.id);
        let consumed = 0;
        const now = new Date();
        
        if (vehicle.limit_period === 'day') {
          const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          consumed = history.filter(t => new Date(t.timestamp) >= startOfDay).reduce((acc, t) => acc + t.amount, 0);
        } else if (vehicle.limit_period === 'week') {
          const day = now.getDay();
          const diff = now.getDate() - day + (day === 0 ? -6 : 1);
          const startOfWeek = new Date(now.getFullYear(), now.getMonth(), diff);
          startOfWeek.setHours(0, 0, 0, 0);
          consumed = history.filter(t => new Date(t.timestamp) >= startOfWeek).reduce((acc, t) => acc + t.amount, 0);
        } else if (vehicle.limit_period === 'month') {
          const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
          consumed = history.filter(t => new Date(t.timestamp) >= startOfMonth).reduce((acc, t) => acc + t.amount, 0);
        } else {
          consumed = history.reduce((acc, t) => acc + t.amount, 0);
        }
        setQuotaInfo({ vehicle, consumed });
        setFormData({ ...formData, type: vehicle.type });
      } else {
        setQuotaInfo(null);
        setMsg({ text: 'Vehicle not found. You can register it by selecting a type below.', type: 'info' });
      }
    } catch (err: any) {
      setMsg({ text: getErrorMessage(err), type: 'error' });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg({ text: '', type: '' });
    try {
      const amount = parseFloat(formData.amount);
      if (isNaN(amount) || amount <= 0) {
        throw new Error('Please enter a valid amount');
      }

      if (quotaInfo) {
        const remaining = quotaInfo.vehicle.fuel_limit - quotaInfo.consumed;
        if (amount > remaining) {
          throw new Error(`Amount exceeds remaining quota (${remaining.toFixed(1)}L). You can pump up to ${remaining.toFixed(1)}L.`);
        }
      }

      let vehicleId: string;
      
      if (quotaInfo) {
        vehicleId = quotaInfo.vehicle.id;
      } else {
        // Try to find the vehicle first in case they didn't click "Check Quota"
        const vehicles = await api.searchVehicles(`${formData.id_prefix}${formData.id_number}`);
        const existingVehicle = vehicles.find(v => v.id_prefix === formData.id_prefix && v.id_number === formData.id_number);
        
        if (existingVehicle) {
          vehicleId = existingVehicle.id;
        } else {
          // Register new vehicle
          if (!formData.type) {
            throw new Error('Please select a vehicle type for new registration');
          }
          const res = await api.createVehicle({
            id_prefix: formData.id_prefix,
            id_number: formData.id_number,
            type: formData.type
          });
          vehicleId = res.id;
        }
      }

      await api.createTransaction({
        vehicle_id: vehicleId,
        agent_id: user.id,
        station_id: user.station_id,
        fuel_type: formData.fuel_type,
        amount: parseFloat(formData.amount)
      });

      setMsg({ text: 'Transaction recorded successfully!', type: 'success' });
      setFormData({ ...formData, amount: '', id_prefix: '', id_number: '', type: '' });
      setQuotaInfo(null);
      loadTransactions();
      setTimeout(() => setShowForm(false), 1500);
    } catch (err: any) {
      setMsg({ text: getErrorMessage(err), type: 'error' });
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Agent Dashboard</h2>
          <p className="opacity-50">Recording fuel at {user.station_name}</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => setShowScanner(true)}
            className="p-4 bg-white text-[#141414] border border-[#141414]/10 rounded-full font-bold flex items-center justify-center hover:bg-[#F5F5F0] transition-all"
            title="Scan QR"
          >
            <Camera className="w-6 h-6" />
          </button>
          <button 
            onClick={() => setShowForm(true)}
            className="p-4 bg-[#141414] text-white rounded-full font-bold flex items-center justify-center hover:bg-opacity-90 transition-all shadow-lg shadow-[#141414]/10"
            title="New Pumping"
          >
            <Plus className="w-6 h-6" />
          </button>
        </div>
      </div>

      {user.station_id && <StationBalanceWidget stationId={String(user.station_id)} />}

      {showScanner && <QRScanner onScan={handleQRScan} onCancel={() => setShowScanner(false)} />}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <div className="bg-white/70 backdrop-blur-xl rounded-3xl border border-white/40 shadow-xl shadow-black/5 overflow-hidden">
            <div className="px-8 py-6 border-b border-[#141414]/5 flex justify-between items-center">
              <h3 className="font-bold text-lg">Your Recent Transactions</h3>
              <History className="w-5 h-5 opacity-20" />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-[#F5F5F0]/50 text-[10px] uppercase tracking-widest font-bold opacity-50">
                    <th className="px-8 py-4">Vehicle</th>
                    <th className="px-8 py-4">Type</th>
                    <th className="px-8 py-4">Fuel</th>
                    <th className="px-8 py-4 text-right">Amount</th>
                    <th className="px-8 py-4">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#141414]/5">
                  {transactions.map(t => (
                    <tr key={t.id} className="hover:bg-[#F5F5F0]/30 transition-colors">
                      <td className="px-8 py-4 font-bold">{t.id_prefix} {t.id_number}</td>
                      <td className="px-8 py-4 text-sm opacity-60">{t.vehicle_type}</td>
                      <td className="px-8 py-4">
                        <span className="px-2 py-1 bg-blue-50 text-blue-600 rounded text-[10px] font-bold uppercase">
                          {t.fuel_type}
                        </span>
                      </td>
                      <td className="px-8 py-4 text-sm font-bold text-right">{t.amount}L</td>
                      <td className="px-8 py-4 text-xs opacity-50">{new Date(t.timestamp).toLocaleTimeString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="bg-white/70 backdrop-blur-xl p-8 rounded-3xl border border-white/40 shadow-xl shadow-black/5 sticky top-24">
            <h3 className="font-bold text-lg mb-6">Station Stats</h3>
            <div className="space-y-4">
              <div className="p-6 bg-white/40 rounded-2xl">
                <p className="text-xs font-bold opacity-40 uppercase tracking-widest mb-1">Today's Total</p>
                <p className="text-3xl font-bold">
                  {transactions.filter(t => new Date(t.timestamp).toDateString() === new Date().toDateString())
                    .reduce((acc, t) => acc + t.amount, 0).toFixed(1)}L
                </p>
              </div>
              <div className="p-6 bg-white/40 rounded-2xl">
                <p className="text-xs font-bold opacity-40 uppercase tracking-widest mb-1">Total Transactions</p>
                <p className="text-3xl font-bold">{transactions.length}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* New Transaction Modal */}
      <AnimatePresence>
        {showForm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-[#141414]/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-y-auto max-h-[90vh]"
            >
              <div className="p-10">
                <div className="flex justify-between items-center mb-8">
                  <h3 className="text-2xl font-bold">New Pumping Entry</h3>
                  <button onClick={() => setShowForm(false)} className="p-2 hover:bg-[#F5F5F0] rounded-full transition-colors">
                    <XCircle className="w-6 h-6 opacity-30" />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  {msg.text && (
                    <div className={`p-4 rounded-2xl text-sm flex items-center gap-3 ${msg.type === 'success' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                      {msg.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                      {msg.text}
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest opacity-40 ml-4">Date & Time (Automatic)</label>
                    <input 
                      type="text" 
                      readOnly
                      className="w-full px-6 py-4 bg-[#F5F5F0] rounded-2xl outline-none opacity-60 cursor-not-allowed"
                      value={new Date().toLocaleString()}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-widest opacity-40 ml-4">ID Prefix</label>
                      <input 
                        type="text" 
                        placeholder="AAA"
                        required
                        className="w-full px-6 py-4 bg-[#F5F5F0] rounded-2xl outline-none"
                        value={formData.id_prefix}
                        onChange={(e) => {
                          const newPrefix = e.target.value.toUpperCase();
                          setFormData(prev => ({ ...prev, id_prefix: newPrefix, type: quotaInfo ? '' : prev.type }));
                          setQuotaInfo(null);
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-widest opacity-40 ml-4">ID Number</label>
                      <input 
                        type="text" 
                        placeholder="0000"
                        required
                        className="w-full px-6 py-4 bg-[#F5F5F0] rounded-2xl outline-none"
                        value={formData.id_number}
                        onChange={(e) => {
                          const newNumber = e.target.value;
                          setFormData(prev => ({ ...prev, id_number: newNumber, type: quotaInfo ? '' : prev.type }));
                          setQuotaInfo(null);
                        }}
                      />
                    </div>
                  </div>

                  <button 
                    type="button"
                    onClick={checkQuota}
                    className="w-full py-3 border-2 border-[#141414] text-[#141414] rounded-2xl font-bold hover:bg-[#141414] hover:text-white transition-all"
                  >
                    Check Vehicle Quota
                  </button>

                  {quotaInfo && (
                    <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">Quota Status (Per {quotaInfo.vehicle.limit_period})</span>
                        <span className="text-xs font-bold text-blue-600">{quotaInfo.vehicle.type}</span>
                      </div>
                      <div className="flex justify-between items-end">
                        <div>
                          <p className="text-2xl font-bold text-blue-900">{(quotaInfo.vehicle.fuel_limit - quotaInfo.consumed).toFixed(1)}L</p>
                          <p className="text-[10px] text-blue-600 font-bold uppercase">Remaining Balance</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-blue-900">{quotaInfo.consumed.toFixed(1)} / {quotaInfo.vehicle.fuel_limit}L</p>
                          <p className="text-[10px] text-blue-600 font-bold uppercase">Consumed</p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest opacity-40 ml-4">Vehicle Type</label>
                    <select 
                      required
                      disabled={!!quotaInfo}
                      className="w-full px-6 py-4 bg-[#F5F5F0] rounded-2xl outline-none appearance-none disabled:opacity-50"
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    >
                      <option value="">Select Type</option>
                      {VEHICLE_TYPES.map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest opacity-40 ml-4">Fuel Type</label>
                    <select 
                      className="w-full px-6 py-4 bg-[#F5F5F0] rounded-2xl outline-none appearance-none"
                      value={formData.fuel_type}
                      onChange={(e) => setFormData({ ...formData, fuel_type: e.target.value })}
                    >
                      <option>Petrol 92</option>
                      <option>Petrol 95</option>
                      <option>Diesel</option>
                      <option>Super Diesel</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest opacity-40 ml-4">Amount (Liters)</label>
                    <div className="relative">
                      <input 
                        type="number" 
                        step="0.1"
                        required
                        className="w-full px-6 py-4 bg-[#F5F5F0] rounded-2xl outline-none text-2xl font-bold pr-24"
                        value={formData.amount}
                        onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      />
                      {quotaInfo && (
                        <button 
                          type="button"
                          onClick={() => {
                            const remaining = Math.max(0, quotaInfo.vehicle.fuel_limit - quotaInfo.consumed);
                            setFormData({ ...formData, amount: remaining.toFixed(1) });
                          }}
                          className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-2 bg-[#141414] text-white rounded-xl text-xs font-bold uppercase"
                        >
                          Max
                        </button>
                      )}
                    </div>
                  </div>

                  <button 
                    type="submit"
                    className="w-full py-5 bg-[#141414] text-white rounded-2xl font-bold text-lg hover:bg-opacity-90 transition-all"
                  >
                    Confirm & Record
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ManagerDashboard({ user }: { user: User }) {
  const [transactions, setTransactions] = useState<FuelTransaction[]>([]);
  const [agents, setAgents] = useState<User[]>([]);
  const [activeTab, setActiveTab] = useState<'transactions' | 'agents'>('transactions');
  const [showAgentForm, setShowAgentForm] = useState(false);
  const [agentData, setAgentData] = useState({ 
    username: '', 
    password: '', 
    full_name: '' 
  });
  const [msg, setMsg] = useState({ text: '', type: '' });

  const throwError = useAsyncError();

  useEffect(() => {
    loadData().catch(throwError);
  }, [activeTab, throwError]);

  const loadData = async () => {
    if (!user.station_id) return;
    if (activeTab === 'transactions') setTransactions(await api.getManagerTransactions(user.station_id));
    if (activeTab === 'agents') setAgents(await api.getManagerAgents(user.station_id));
  };

  const handleCreateAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user.station_id) return;
    try {
      await api.createSystemUser({
        ...agentData,
        role: 'agent',
        station_id: user.station_id
      });
      setMsg({ text: 'Agent created successfully!', type: 'success' });
      setAgentData({ username: '', password: '', full_name: '' });
      loadData();
      setTimeout(() => setShowAgentForm(false), 1500);
    } catch (err: any) {
      setMsg({ text: getErrorMessage(err), type: 'error' });
    }
  };

  const handleDeleteAgent = async (agentId: string) => {
    if (confirm('Are you sure you want to delete this agent?')) {
      await api.deleteUser(agentId);
      loadData();
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Manager Dashboard</h2>
          <p className="opacity-50">Managing {user.station_name}</p>
        </div>
        {activeTab === 'agents' && (
          <button 
            onClick={() => { setShowAgentForm(true); setMsg({ text: '', type: '' }); }}
            className="px-6 py-3 bg-[#141414] text-white rounded-full font-bold flex items-center gap-2 hover:bg-opacity-90 transition-all shadow-lg shadow-[#141414]/10"
          >
            <Plus className="w-5 h-5" /> Add Agent
          </button>
        )}
      </div>

      {user.station_id && <StationBalanceWidget stationId={String(user.station_id)} />}

      <div className="flex gap-2 p-1 bg-white rounded-2xl border border-[#141414]/5 w-fit">
        <button
          onClick={() => setActiveTab('transactions')}
          className={`px-6 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'transactions' ? 'bg-[#141414] text-white shadow-md' : 'hover:bg-[#F5F5F0]'}`}
        >
          Transactions
        </button>
        <button
          onClick={() => setActiveTab('agents')}
          className={`px-6 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'agents' ? 'bg-[#141414] text-white shadow-md' : 'hover:bg-[#F5F5F0]'}`}
        >
          Pumping Agents
        </button>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'transactions' && (
          <motion.div 
            key="transactions"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/70 backdrop-blur-xl rounded-3xl border border-white/40 shadow-xl shadow-black/5 overflow-hidden"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-[#F5F5F0]/50 text-[10px] uppercase tracking-widest font-bold opacity-50">
                    <th className="px-8 py-4">Time</th>
                    <th className="px-8 py-4">Vehicle</th>
                    <th className="px-8 py-4">Type</th>
                    <th className="px-8 py-4">Agent</th>
                    <th className="px-8 py-4 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#141414]/5">
                  {transactions.map(t => (
                    <tr key={t.id} className="hover:bg-[#F5F5F0]/30 transition-colors">
                      <td className="px-8 py-4 text-sm">{new Date(t.timestamp).toLocaleString()}</td>
                      <td className="px-8 py-4 font-bold">{t.id_prefix} {t.id_number}</td>
                      <td className="px-8 py-4 text-sm opacity-60">{t.vehicle_type}</td>
                      <td className="px-8 py-4 text-sm font-medium">{t.agent_name}</td>
                      <td className="px-8 py-4 text-sm font-bold text-right">{t.amount}L</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {activeTab === 'agents' && (
          <motion.div 
            key="agents"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/70 backdrop-blur-xl rounded-3xl border border-white/40 shadow-xl shadow-black/5 overflow-hidden"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-[#F5F5F0]/50 text-[10px] uppercase tracking-widest font-bold opacity-50">
                    <th className="px-8 py-4">Username</th>
                    <th className="px-8 py-4">Status</th>
                    <th className="px-8 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#141414]/5">
                  {agents.map(a => (
                    <tr key={a.id} className="hover:bg-[#F5F5F0]/30 transition-colors">
                      <td className="px-8 py-4 font-bold">{a.username}</td>
                      <td className="px-8 py-4">
                        <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${a.status === 'active' ? 'bg-green-50 text-green-600' : a.status === 'pending' ? 'bg-yellow-50 text-yellow-600' : 'bg-red-50 text-red-600'}`}>
                          {a.status}
                        </span>
                      </td>
                      <td className="px-8 py-4 text-right flex justify-end gap-2">
                        <button className="text-xs font-bold hover:underline">Edit</button>
                        <button onClick={() => handleDeleteAgent(a.id)} className="text-xs font-bold text-red-600 hover:underline">Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showAgentForm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-[#141414]/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl"
            >
              <div className="p-10">
                <div className="flex justify-between items-center mb-8">
                  <h3 className="text-2xl font-bold">Add Pumping Agent</h3>
                  <button onClick={() => setShowAgentForm(false)} className="p-2 hover:bg-[#F5F5F0] rounded-full transition-colors">
                    <XCircle className="w-6 h-6 opacity-30" />
                  </button>
                </div>
                <form onSubmit={handleCreateAgent} className="space-y-6">
                  {msg.text && (
                    <div className={`p-4 rounded-2xl text-sm flex items-center gap-3 ${msg.type === 'success' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                      {msg.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                      {msg.text}
                    </div>
                  )}
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest opacity-40 ml-4">Username</label>
                    <input 
                      type="text" 
                      required
                      className="w-full px-6 py-4 bg-[#F5F5F0] rounded-2xl outline-none"
                      value={agentData.username}
                      onChange={(e) => setAgentData({ ...agentData, username: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest opacity-40 ml-4">Password</label>
                    <input 
                      type="password" 
                      required
                      minLength={6}
                      className="w-full px-6 py-4 bg-[#F5F5F0] rounded-2xl outline-none"
                      value={agentData.password}
                      onChange={(e) => setAgentData({ ...agentData, password: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest opacity-40 ml-4">Full Name</label>
                    <input 
                      type="text" 
                      required
                      className="w-full px-6 py-4 bg-[#F5F5F0] rounded-2xl outline-none"
                      value={agentData.full_name}
                      onChange={(e) => setAgentData({ ...agentData, full_name: e.target.value })}
                    />
                  </div>
                  <button type="submit" className="w-full py-5 bg-[#141414] text-white rounded-2xl font-bold text-lg">Create Agent</button>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function PublicStationBalances() {
  const [stations, setStations] = useState<FuelStation[]>([]);
  const [agents, setAgents] = useState<User[]>([]);
  const [transactions, setTransactions] = useState<FuelTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'location'>('name');

  useEffect(() => {
    Promise.all([api.getStationBalances(), api.getAgents(), api.getDetailedTransactions()]).then(([stations, agents, transactions]) => {
      setStations(stations);
      setAgents(agents);
      setTransactions(transactions);
      setLoading(false);
    });
  }, []);

  if (loading) return (
    <div className="flex justify-center py-12">
      <div className="w-8 h-8 border-4 border-[#141414] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const filteredStations = stations
    .filter(s => 
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      s.location.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      return a.location.localeCompare(b.location);
    });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white/50 p-4 rounded-3xl border border-[#141414]/5">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 opacity-30" />
          <input 
            type="text" 
            placeholder="Search by station name or location..."
            className="w-full pl-12 pr-6 py-3 bg-white rounded-2xl outline-none border border-[#141414]/5 focus:border-[#141414]/20 transition-all text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <span className="text-xs font-bold uppercase tracking-widest opacity-40 whitespace-nowrap">Sort by:</span>
          <select 
            className="bg-white px-4 py-2 rounded-xl border border-[#141414]/5 text-sm font-medium outline-none"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
          >
            <option value="name">Name</option>
            <option value="location">Location</option>
          </select>
        </div>
      </div>

      {filteredStations.length === 0 ? (
        <div className="text-center py-12 bg-white/30 rounded-3xl border border-dashed border-[#141414]/10">
          <p className="opacity-40 font-medium">No stations found matching your search.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredStations.map(station => {
            const totalBalance = station.balance_petrol_92 + station.balance_petrol_95 + station.balance_diesel + station.balance_super_diesel;
            const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
            const recentTransactions = transactions.filter(t => t.station_id === station.id && new Date(t.timestamp) >= oneHourAgo);
            const consumptionRate = recentTransactions.reduce((acc, t) => acc + t.amount, 0);
            
            // Normalize consumption rate: assume 1500L/hr is 100%
            const trafficLevel = Math.min(100, Math.max(0, (consumptionRate / 1500) * 100));
            const liveAgents = agents.filter(a => a.station_id === station.id && a.status === 'active').length;
            
            return (
              <div key={station.id} className="bg-white/70 backdrop-blur-xl p-8 rounded-3xl border border-white/40 shadow-xl shadow-black/5">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h4 className="font-bold text-lg">{station.name}</h4>
                    <p className="text-xs opacity-50 flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> {station.location}
                    </p>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${totalBalance > 1000 ? 'bg-green-50 text-green-600' : 'bg-orange-50 text-orange-600'}`}>
                    {totalBalance > 0 ? 'Available' : 'Out of Stock'}
                  </div>
                </div>
                
                <div className="mt-4 mb-6">
                  <p className="text-sm font-semibold mb-2">Consumption Rate (Last Hour)</p>
                  <TrafficBar level={trafficLevel} />
                  <p className="text-xs opacity-60 mt-1">{consumptionRate.toLocaleString()} L/hr</p>
                  <p className="text-sm font-semibold mt-4">Live Agents Online: {liveAgents}</p>
                </div>
                
                <div className="space-y-4 pt-4 border-t border-[#141414]/5">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] uppercase tracking-widest font-bold opacity-40 mb-1">Petrol 92</p>
                      <p className="text-xl font-bold">{station.balance_petrol_92.toLocaleString()}L</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-widest font-bold opacity-40 mb-1">Petrol 95</p>
                      <p className="text-xl font-bold">{station.balance_petrol_95.toLocaleString()}L</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-widest font-bold opacity-40 mb-1">Diesel</p>
                      <p className="text-xl font-bold">{station.balance_diesel.toLocaleString()}L</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-widest font-bold opacity-40 mb-1">Super Diesel</p>
                      <p className="text-xl font-bold">{station.balance_super_diesel.toLocaleString()}L</p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AnalyticsDashboard({ typeLimits }: { typeLimits: VehicleTypeLimit[] }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const throwError = useAsyncError();

  useEffect(() => {
    api.getAnalytics()
      .then(setData)
      .catch(throwError)
      .finally(() => setLoading(false));
  }, [throwError]);

  if (loading || !data) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#141414]"></div>
    </div>
  );

  const COLORS = ['#141414', '#5A5A40', '#F27D26', '#FF4444', '#8E9299'];

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white/70 backdrop-blur-xl p-8 rounded-3xl border border-white/40 shadow-xl shadow-black/5">
          <p className="text-xs font-bold opacity-40 uppercase tracking-widest mb-2">Fuel Distributed Today</p>
          <p className="text-4xl font-bold">{data.todayFuel.toFixed(1)}L</p>
        </div>
        <div className="bg-white/70 backdrop-blur-xl p-8 rounded-3xl border border-white/40 shadow-xl shadow-black/5">
          <p className="text-xs font-bold opacity-40 uppercase tracking-widest mb-2">Active Stations</p>
          <p className="text-4xl font-bold">{data.fuelPerStation.length}</p>
        </div>
        <div className="bg-white/70 backdrop-blur-xl p-8 rounded-3xl border border-white/40 shadow-xl shadow-black/5">
          <p className="text-xs font-bold opacity-40 uppercase tracking-widest mb-2">Peak Hour</p>
          <p className="text-4xl font-bold">
            {data.peakHours.length > 0 
              ? `${data.peakHours.reduce((prev: any, current: any) => (prev.count > current.count) ? prev : current).hour}:00`
              : 'N/A'}
          </p>
        </div>
        <div className="bg-white/70 backdrop-blur-xl p-8 rounded-3xl border border-white/40 shadow-xl shadow-black/5">
          <p className="text-xs font-bold opacity-40 uppercase tracking-widest mb-2">Top Station</p>
          <p className="text-xl font-bold truncate">
            {data.fuelPerStation.length > 0
              ? data.fuelPerStation.reduce((prev: any, current: any) => (prev.total > current.total) ? prev : current).name
              : 'N/A'}
          </p>
        </div>
      </div>

      <div className="bg-white/70 backdrop-blur-xl p-8 rounded-3xl border border-white/40 shadow-xl shadow-black/5">
        <h3 className="font-bold text-lg mb-6">Vehicle Type Limits</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {typeLimits.map(limit => (
            <div key={limit.type} className="p-4 bg-[#F5F5F0] rounded-2xl">
              <p className="text-xs font-bold opacity-40 uppercase tracking-widest mb-1">{limit.type}</p>
              <p className="text-xl font-bold">{limit.fuel_limit}L / {limit.limit_period}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* ... existing charts ... */}
        {/* Fuel Per Station - Bar Chart */}
        <div className="bg-white/70 backdrop-blur-xl p-8 rounded-3xl border border-white/40 shadow-xl shadow-black/5">
          <h3 className="font-bold text-lg mb-6">Fuel Distributed per Station</h3>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.fuelPerStation}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                <XAxis dataKey="name" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="total" fill="#141414" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Fuel Distribution Trends - Line Chart */}
        <div className="bg-white/70 backdrop-blur-xl p-8 rounded-3xl border border-white/40 shadow-xl shadow-black/5">
          <h3 className="font-bold text-lg mb-6">Fuel Distribution Trends (Last 30 Days)</h3>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.trends}>
                <defs>
                  <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#141414" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#141414" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                <XAxis dataKey="date" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                   contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Area type="monotone" dataKey="total" stroke="#141414" fillOpacity={1} fill="url(#colorTotal)" strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Fuel by Type - Pie Chart */}
        <div className="bg-white/70 backdrop-blur-xl p-8 rounded-3xl border border-white/40 shadow-xl shadow-black/5">
          <h3 className="font-bold text-lg mb-6">Fuel Distribution by Type</h3>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.fuelByType}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {data.fuelByType.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                   contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Legend verticalAlign="bottom" height={36}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Peak Hours - Hourly Chart */}
        <div className="bg-white/70 backdrop-blur-xl p-8 rounded-3xl border border-white/40 shadow-xl shadow-black/5">
          <h3 className="font-bold text-lg mb-6">Peak Distribution Hours</h3>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.peakHours}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                <XAxis dataKey="hour" fontSize={12} tickLine={false} axisLine={false} label={{ value: 'Hour of Day', position: 'insideBottom', offset: -5 }} />
                <YAxis fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                   contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="count" fill="#F27D26" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

function AdminDashboard({ user }: { user: User }) {
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'vehicles' | 'stations' | 'audit' | 'limits' | 'reports' | 'distribution'>('overview');
  const [summary, setSummary] = useState<any>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [stations, setStations] = useState<FuelStation[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [typeLimits, setTypeLimits] = useState<VehicleTypeLimit[]>([]);
  const [detailedTransactions, setDetailedTransactions] = useState<FuelTransaction[]>([]);
  const [stationReports, setStationReports] = useState<any[]>([]);
  const [distributions, setDistributions] = useState<FuelDistribution[]>([]);
  
  const [reportFilters, setReportFilters] = useState({
    station_id: '',
    fuel_type: '',
    start_date: '',
    end_date: '',
    vehicle_q: ''
  });
  
  const [showUserForm, setShowUserForm] = useState(false);
  const [userData, setUserData] = useState({ 
    username: '', 
    password: '', 
    full_name: '', 
    role: 'agent', 
    station_id: '' 
  });
  
  const [showTypeForm, setShowTypeForm] = useState(false);
  const [typeData, setTypeData] = useState({ type: '', fuel_limit: '', limit_period: 'week' });

  const [showStationForm, setShowStationForm] = useState(false);
  const [stationData, setStationData] = useState({ name: '', location: '' });

  const [showFuelForm, setShowFuelForm] = useState(false);
  const [fuelData, setFuelData] = useState({ station_id: '', amount: '', fuel_type: 'Petrol 92' });

  const [msg, setMsg] = useState({ text: '', type: '' });

  const throwError = useAsyncError();

  useEffect(() => {
    loadData().catch(throwError);
  }, [activeTab, reportFilters, throwError]);

  const loadData = async () => {
    if (activeTab === 'overview') {
      setSummary(await api.getSummary());
      setTypeLimits(await api.getTypeLimits());
    }
    if (activeTab === 'users') {
      setUsers(await api.getUsers());
      setStations(await api.getStations());
    }
    if (activeTab === 'vehicles') setVehicles(await api.getVehicles());
    if (activeTab === 'stations') setStations(await api.getStations());
    if (activeTab === 'audit') setAuditLogs(await api.getAuditLogs());
    if (activeTab === 'limits') setTypeLimits(await api.getTypeLimits());
    if (activeTab === 'reports') {
      setDetailedTransactions(await api.getDetailedTransactions(reportFilters));
      setStationReports(await api.getStationReports(reportFilters));
      setStations(await api.getStations());
    }
    if (activeTab === 'distribution') {
      setDistributions(await api.getStationDistributions(reportFilters));
      setStations(await api.getStations());
    }
  };

  const handleAddFuel = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.addStationFuel(fuelData.station_id, parseFloat(fuelData.amount), fuelData.fuel_type);
      setMsg({ text: 'Fuel distributed successfully!', type: 'success' });
      setFuelData({ station_id: '', amount: '', fuel_type: 'Petrol 92' });
      loadData();
      setTimeout(() => setShowFuelForm(false), 1500);
    } catch (err: any) {
      setMsg({ text: getErrorMessage(err), type: 'error' });
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const stationId = (userData.role === 'agent' || userData.role === 'manager') 
        ? (userData.station_id || null) 
        : null;
      
      await api.createSystemUser({
        ...userData,
        station_id: stationId
      });
      setMsg({ text: 'User created successfully!', type: 'success' });
      setUserData({ 
        username: '', 
        password: '', 
        full_name: '', 
        role: 'agent', 
        station_id: '' 
      });
      loadData();
      setTimeout(() => setShowUserForm(false), 1500);
    } catch (err: any) {
      setMsg({ text: getErrorMessage(err), type: 'error' });
    }
  };

  const handleCreateType = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createTypeLimit(typeData.type, parseFloat(typeData.fuel_limit), typeData.limit_period);
      setMsg({ text: 'Vehicle type created successfully!', type: 'success' });
      setTypeData({ type: '', fuel_limit: '', limit_period: 'week' });
      loadData();
      setTimeout(() => setShowTypeForm(false), 1500);
    } catch (err: any) {
      setMsg({ text: getErrorMessage(err), type: 'error' });
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (confirm('Are you sure you want to delete this user?')) {
      await api.deleteUser(userId);
      loadData();
    }
  };

  const handleUpdateLimit = async (type: string, limit: number, period: string) => {
    await api.updateTypeLimit(type, limit, period);
    loadData();
  };

  const handleDeleteStation = async (stationId: string) => {
    if (confirm('Are you sure you want to delete this station?')) {
      await api.deleteStation(stationId);
      loadData();
    }
  };

  const handleCreateStation = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createStation(stationData);
      setMsg({ text: 'Station created successfully!', type: 'success' });
      setStationData({ name: '', location: '' });
      loadData();
      setTimeout(() => setShowStationForm(false), 1500);
    } catch (err: any) {
      setMsg({ text: getErrorMessage(err), type: 'error' });
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Admin Control Panel</h2>
          <p className="opacity-50">System-wide monitoring and management</p>
        </div>
        <div className="flex gap-2">
          {activeTab === 'users' && (
            <button 
              onClick={() => { setShowUserForm(true); setMsg({ text: '', type: '' }); }}
              className="px-6 py-3 bg-[#141414] text-white rounded-full font-bold flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Add User
            </button>
          )}
          {activeTab === 'limits' && (
            <button 
              onClick={() => { setShowTypeForm(true); setMsg({ text: '', type: '' }); }}
              className="px-6 py-3 bg-[#141414] text-white rounded-full font-bold flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Add Type
            </button>
          )}
          {activeTab === 'stations' && (
            <button 
              onClick={() => { setShowStationForm(true); setMsg({ text: '', type: '' }); }}
              className="px-6 py-3 bg-[#141414] text-white rounded-full font-bold flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Add Station
            </button>
          )}
          {activeTab === 'distribution' && (
            <button 
              onClick={() => { setShowFuelForm(true); setMsg({ text: '', type: '' }); }}
              className="px-6 py-3 bg-[#141414] text-white rounded-full font-bold flex items-center gap-2"
            >
              <Droplets className="w-4 h-4" /> Distribute Fuel
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 p-1 bg-white rounded-2xl border border-[#141414]/5 w-fit">
        {[
          { id: 'overview', icon: TrendingUp, label: 'Analytics' },
          { id: 'reports', icon: FileText, label: 'Reports' },
          { id: 'distribution', icon: Droplets, label: 'Fuel Distribution' },
          { id: 'users', icon: Users, label: 'Users' },
          { id: 'limits', icon: Settings, label: 'Type Limits' },
          { id: 'vehicles', icon: Car, label: 'Vehicles' },
          { id: 'stations', icon: MapPin, label: 'Stations' },
          { id: 'audit', icon: Shield, label: 'Audit Logs' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-6 py-3 rounded-xl text-sm font-bold flex items-center gap-2 transition-all ${
              activeTab === tab.id ? 'bg-[#141414] text-white shadow-md' : 'hover:bg-[#F5F5F0]'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'overview' && (
          <motion.div 
            key="overview"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <AnalyticsDashboard typeLimits={typeLimits} />
          </motion.div>
        )}

        {activeTab === 'reports' && (
          <motion.div 
            key="reports"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
          >
            {/* Filters */}
            <div className="bg-white/70 backdrop-blur-xl p-6 rounded-3xl border border-white/40 shadow-xl shadow-black/5">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase opacity-40 ml-2">Station</label>
                  <select 
                    className="w-full px-4 py-2 bg-[#F5F5F0] rounded-xl text-sm outline-none"
                    value={reportFilters.station_id}
                    onChange={(e) => setReportFilters({ ...reportFilters, station_id: e.target.value })}
                  >
                    <option value="">All Stations</option>
                    {stations.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase opacity-40 ml-2">Fuel Type</label>
                  <select 
                    className="w-full px-4 py-2 bg-[#F5F5F0] rounded-xl text-sm outline-none"
                    value={reportFilters.fuel_type}
                    onChange={(e) => setReportFilters({ ...reportFilters, fuel_type: e.target.value })}
                  >
                    <option value="">All Types</option>
                    <option value="Petrol 92">Petrol 92</option>
                    <option value="Petrol 95">Petrol 95</option>
                    <option value="Diesel">Diesel</option>
                    <option value="Super Diesel">Super Diesel</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase opacity-40 ml-2">Start Date</label>
                  <input 
                    type="date"
                    className="w-full px-4 py-2 bg-[#F5F5F0] rounded-xl text-sm outline-none"
                    value={reportFilters.start_date}
                    onChange={(e) => setReportFilters({ ...reportFilters, start_date: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase opacity-40 ml-2">End Date</label>
                  <input 
                    type="date"
                    className="w-full px-4 py-2 bg-[#F5F5F0] rounded-xl text-sm outline-none"
                    value={reportFilters.end_date}
                    onChange={(e) => setReportFilters({ ...reportFilters, end_date: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase opacity-40 ml-2">Vehicle Search</label>
                  <input 
                    type="text"
                    placeholder="Search vehicle..."
                    className="w-full px-4 py-2 bg-[#F5F5F0] rounded-xl text-sm outline-none"
                    value={reportFilters.vehicle_q}
                    onChange={(e) => setReportFilters({ ...reportFilters, vehicle_q: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <button 
                  onClick={() => setReportFilters({ station_id: '', fuel_type: '', start_date: '', end_date: '', vehicle_q: '' })}
                  className="px-4 py-2 text-xs font-bold uppercase opacity-50 hover:opacity-100 transition-opacity"
                >
                  Clear Filters
                </button>
              </div>
            </div>

            <div className="bg-white/70 backdrop-blur-xl rounded-3xl border border-white/40 shadow-xl shadow-black/5 overflow-hidden">
              <div className="px-8 py-6 border-b border-[#141414]/5 flex justify-between items-center">
                <h3 className="font-bold text-lg">Station Fuel Distribution Report</h3>
                <div className="flex gap-2">
                  <button 
                    onClick={() => exportToExcel(stationReports, 'station_distribution_report')}
                    className="p-2 hover:bg-[#F5F5F0] rounded-lg transition-colors"
                    title="Export to Excel"
                  >
                    <FileText className="w-4 h-4 opacity-40" />
                  </button>
                  <button 
                    onClick={() => {
                      const headers = ['Station', 'Location', 'Petrol 92', 'Petrol 95', 'Diesel', 'Super Diesel', 'Total Pumped'];
                      const data = stationReports.map(r => [
                        r.name, r.location, 
                        `${r.balance_petrol_92}L`, `${r.balance_petrol_95}L`, 
                        `${r.balance_diesel}L`, `${r.balance_super_diesel}L`, 
                        `${r.total_pumped?.toFixed(1) || 0}L`
                      ]);
                      exportToPDF(headers, data, 'station_distribution_report', 'Station Fuel Distribution Report');
                    }}
                    className="p-2 hover:bg-[#F5F5F0] rounded-lg transition-colors"
                    title="Export to PDF"
                  >
                    <CreditCard className="w-4 h-4 opacity-40" />
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-[#F5F5F0]/50 text-[10px] uppercase tracking-widest font-bold opacity-50">
                      <th className="px-8 py-4">Station</th>
                      <th className="px-8 py-4">Location</th>
                      <th className="px-8 py-4 text-right">Petrol 92</th>
                      <th className="px-8 py-4 text-right">Petrol 95</th>
                      <th className="px-8 py-4 text-right">Diesel</th>
                      <th className="px-8 py-4 text-right">Super Diesel</th>
                      <th className="px-8 py-4 text-right">Total Pumped</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#141414]/5">
                    {stationReports.map(r => (
                      <tr key={r.id} className="hover:bg-[#F5F5F0]/30 transition-colors">
                        <td className="px-8 py-4 font-bold">{r.name}</td>
                        <td className="px-8 py-4 text-sm opacity-60">{r.location}</td>
                        <td className="px-8 py-4 text-sm font-bold text-right">{r.balance_petrol_92?.toLocaleString()}L</td>
                        <td className="px-8 py-4 text-sm font-bold text-right">{r.balance_petrol_95?.toLocaleString()}L</td>
                        <td className="px-8 py-4 text-sm font-bold text-right">{r.balance_diesel?.toLocaleString()}L</td>
                        <td className="px-8 py-4 text-sm font-bold text-right">{r.balance_super_diesel?.toLocaleString()}L</td>
                        <td className="px-8 py-4 text-sm font-bold text-right text-blue-600">{r.total_pumped?.toFixed(1) || 0}L</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white/70 backdrop-blur-xl rounded-3xl border border-white/40 shadow-xl shadow-black/5 overflow-hidden">
              <div className="px-8 py-6 border-b border-[#141414]/5 flex justify-between items-center">
                <h3 className="font-bold text-lg">Detailed Transaction History</h3>
                <div className="flex gap-2">
                  <button 
                    onClick={() => exportToExcel(detailedTransactions, 'transaction_report')}
                    className="p-2 hover:bg-[#F5F5F0] rounded-lg transition-colors"
                    title="Export to Excel"
                  >
                    <FileText className="w-4 h-4 opacity-40" />
                  </button>
                  <button 
                    onClick={() => {
                      const headers = ['Date & Time', 'Vehicle', 'Fuel Type', 'Agent', 'Station', 'Amount'];
                      const data = detailedTransactions.map(t => [
                        new Date(t.timestamp).toLocaleString(),
                        `${t.id_prefix} ${t.id_number}`,
                        t.fuel_type,
                        t.agent_name,
                        t.station_name,
                        `${t.amount}L`
                      ]);
                      exportToPDF(headers, data, 'transaction_report', 'Detailed Transaction History');
                    }}
                    className="p-2 hover:bg-[#F5F5F0] rounded-lg transition-colors"
                    title="Export to PDF"
                  >
                    <CreditCard className="w-4 h-4 opacity-40" />
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-[#F5F5F0]/50 text-[10px] uppercase tracking-widest font-bold opacity-50">
                      <th className="px-8 py-4">Date & Time</th>
                      <th className="px-8 py-4">Vehicle</th>
                      <th className="px-8 py-4">Fuel Type</th>
                      <th className="px-8 py-4">Agent</th>
                      <th className="px-8 py-4">Station</th>
                      <th className="px-8 py-4 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#141414]/5">
                    {detailedTransactions.map(t => (
                      <tr key={t.id} className="hover:bg-[#F5F5F0]/30 transition-colors">
                        <td className="px-8 py-4 text-sm">{new Date(t.timestamp).toLocaleString()}</td>
                        <td className="px-8 py-4 font-bold">{t.id_prefix} {t.id_number}</td>
                        <td className="px-8 py-4 text-xs font-bold opacity-50">{t.fuel_type}</td>
                        <td className="px-8 py-4 text-sm font-medium">{t.agent_name}</td>
                        <td className="px-8 py-4 text-sm">{t.station_name}</td>
                        <td className="px-8 py-4 text-sm font-bold text-right">{t.amount}L</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'distribution' && (
          <motion.div 
            key="distribution"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
          >
            {/* Filters */}
            <div className="bg-white/70 backdrop-blur-xl p-6 rounded-3xl border border-white/40 shadow-xl shadow-black/5">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase opacity-40 ml-2">Station</label>
                  <select 
                    className="w-full px-4 py-2 bg-[#F5F5F0] rounded-xl text-sm outline-none"
                    value={reportFilters.station_id}
                    onChange={(e) => setReportFilters({ ...reportFilters, station_id: e.target.value })}
                  >
                    <option value="">All Stations</option>
                    {stations.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase opacity-40 ml-2">Fuel Type</label>
                  <select 
                    className="w-full px-4 py-2 bg-[#F5F5F0] rounded-xl text-sm outline-none"
                    value={reportFilters.fuel_type}
                    onChange={(e) => setReportFilters({ ...reportFilters, fuel_type: e.target.value })}
                  >
                    <option value="">All Types</option>
                    <option value="Petrol 92">Petrol 92</option>
                    <option value="Petrol 95">Petrol 95</option>
                    <option value="Diesel">Diesel</option>
                    <option value="Super Diesel">Super Diesel</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase opacity-40 ml-2">Start Date</label>
                  <input 
                    type="date"
                    className="w-full px-4 py-2 bg-[#F5F5F0] rounded-xl text-sm outline-none"
                    value={reportFilters.start_date}
                    onChange={(e) => setReportFilters({ ...reportFilters, start_date: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase opacity-40 ml-2">End Date</label>
                  <input 
                    type="date"
                    className="w-full px-4 py-2 bg-[#F5F5F0] rounded-xl text-sm outline-none"
                    value={reportFilters.end_date}
                    onChange={(e) => setReportFilters({ ...reportFilters, end_date: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-3xl border border-[#141414]/5 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-[#F5F5F0]/50 text-[10px] uppercase tracking-widest font-bold opacity-50">
                    <th className="px-8 py-4">Date & Time</th>
                    <th className="px-8 py-4">Station</th>
                    <th className="px-8 py-4">Fuel Type</th>
                    <th className="px-8 py-4 text-right">Amount Distributed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#141414]/5">
                  {distributions.map(d => (
                    <tr key={d.id} className="hover:bg-[#F5F5F0]/30 transition-colors">
                      <td className="px-8 py-4 text-sm">{new Date(d.timestamp).toLocaleString()}</td>
                      <td className="px-8 py-4 font-bold">{d.station_name}</td>
                      <td className="px-8 py-4 text-xs font-bold opacity-50">{d.fuel_type}</td>
                      <td className="px-8 py-4 text-sm font-bold text-right text-green-600">+{d.amount}L</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      )}

        {activeTab === 'users' && (
          <motion.div 
            key="users"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-3xl border border-[#141414]/5 shadow-sm overflow-hidden"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-[#F5F5F0]/50 text-[10px] uppercase tracking-widest font-bold opacity-50">
                    <th className="px-8 py-4">Username</th>
                    <th className="px-8 py-4">Full Name</th>
                    <th className="px-8 py-4">Role</th>
                    <th className="px-8 py-4">Station</th>
                    <th className="px-8 py-4">Status</th>
                    <th className="px-8 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#141414]/5">
                  {users.map(u => (
                    <tr key={u.id} className="hover:bg-[#F5F5F0]/30 transition-colors">
                      <td className="px-8 py-4 font-bold">{u.username}</td>
                      <td className="px-8 py-4 text-sm font-bold opacity-70">{u.full_name || 'N/A'}</td>
                      <td className="px-8 py-4 text-sm uppercase tracking-wider font-bold opacity-50">{u.role}</td>
                      <td className="px-8 py-4 text-sm">{u.station_name || 'N/A'}</td>
                      <td className="px-8 py-4">
                        <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                          u.status === 'active' ? 'bg-green-50 text-green-600' : u.status === 'pending' ? 'bg-yellow-50 text-yellow-600' : 'bg-red-50 text-red-600'
                        }`}>
                          {u.status}
                        </span>
                      </td>
                      <td className="px-8 py-4 text-right flex justify-end gap-2">
                        <button className="text-xs font-bold hover:underline">Edit</button>
                        <button onClick={() => handleDeleteUser(u.id)} className="text-xs font-bold text-red-600 hover:underline">Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {activeTab === 'limits' && (
          <motion.div 
            key="limits"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {typeLimits.map(limit => (
              <div key={limit.type} className="bg-white p-6 rounded-3xl border border-[#141414]/5 shadow-sm">
                <p className="text-xs font-bold opacity-40 uppercase tracking-widest mb-2">{limit.type}</p>
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <input 
                      type="number" 
                      className="flex-1 px-4 py-2 bg-[#F5F5F0] rounded-xl font-bold text-xl outline-none"
                      defaultValue={limit.fuel_limit}
                      onBlur={(e) => handleUpdateLimit(limit.type, parseFloat(e.target.value), limit.limit_period)}
                    />
                    <span className="font-bold opacity-30">Liters</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase opacity-30">Per</span>
                    <select 
                      className="flex-1 px-3 py-1 bg-[#F5F5F0] rounded-lg text-xs font-bold outline-none"
                      value={limit.limit_period}
                      onChange={(e) => handleUpdateLimit(limit.type, limit.fuel_limit, e.target.value)}
                    >
                      <option value="day">Day</option>
                      <option value="week">Week</option>
                      <option value="month">Month</option>
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </motion.div>
        )}

        {activeTab === 'vehicles' && (
          <motion.div 
            key="vehicles"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-3xl border border-[#141414]/5 shadow-sm overflow-hidden"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-[#F5F5F0]/50 text-[10px] uppercase tracking-widest font-bold opacity-50">
                    <th className="px-8 py-4">Vehicle ID</th>
                    <th className="px-8 py-4">Type</th>
                    <th className="px-8 py-4 text-right">Fuel Limit</th>
                    <th className="px-8 py-4">Period</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#141414]/5">
                  {vehicles.map(v => (
                    <tr key={v.id} className="hover:bg-[#F5F5F0]/30 transition-colors">
                      <td className="px-8 py-4 font-bold">{v.id_prefix} {v.id_number}</td>
                      <td className="px-8 py-4 text-sm">{v.type}</td>
                      <td className="px-8 py-4 text-sm font-bold text-right">{v.fuel_limit}L</td>
                      <td className="px-8 py-4 text-xs opacity-50 uppercase tracking-wider">{v.limit_period}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {activeTab === 'stations' && (
          <motion.div 
            key="stations"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-3xl border border-[#141414]/5 shadow-sm overflow-hidden"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-[#F5F5F0]/50 text-[10px] uppercase tracking-widest font-bold opacity-50">
                    <th className="px-8 py-4">Station Name</th>
                    <th className="px-8 py-4">Location</th>
                    <th className="px-8 py-4 text-right">Petrol 92</th>
                    <th className="px-8 py-4 text-right">Petrol 95</th>
                    <th className="px-8 py-4 text-right">Diesel</th>
                    <th className="px-8 py-4 text-right">Super Diesel</th>
                    <th className="px-8 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#141414]/5">
                  {stations.map(s => (
                    <tr key={s.id} className="hover:bg-[#F5F5F0]/30 transition-colors">
                      <td className="px-8 py-4 font-bold">{s.name}</td>
                      <td className="px-8 py-4 text-sm">{s.location}</td>
                      <td className="px-8 py-4 text-sm font-bold text-right">{s.balance_petrol_92?.toLocaleString()}L</td>
                      <td className="px-8 py-4 text-sm font-bold text-right">{s.balance_petrol_95?.toLocaleString()}L</td>
                      <td className="px-8 py-4 text-sm font-bold text-right">{s.balance_diesel?.toLocaleString()}L</td>
                      <td className="px-8 py-4 text-sm font-bold text-right">{s.balance_super_diesel?.toLocaleString()}L</td>
                      <td className="px-8 py-4 text-right flex justify-end gap-2">
                        <button className="text-xs font-bold hover:underline">Edit</button>
                        <button onClick={() => handleDeleteStation(s.id)} className="text-xs font-bold text-red-600 hover:underline">Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {activeTab === 'audit' && (
          <motion.div 
            key="audit"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-3xl border border-[#141414]/5 shadow-sm overflow-hidden"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-[#F5F5F0]/50 text-[10px] uppercase tracking-widest font-bold opacity-50">
                    <th className="px-8 py-4">Time</th>
                    <th className="px-8 py-4">User</th>
                    <th className="px-8 py-4">Action</th>
                    <th className="px-8 py-4">Old Value</th>
                    <th className="px-8 py-4">New Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#141414]/5">
                  {auditLogs.map(log => (
                    <tr key={log.id} className="hover:bg-[#F5F5F0]/30 transition-colors">
                      <td className="px-8 py-4 text-xs opacity-50">{new Date(log.timestamp).toLocaleString()}</td>
                      <td className="px-8 py-4 font-bold">{log.username}</td>
                      <td className="px-8 py-4 text-sm">{log.action}</td>
                      <td className="px-8 py-4 text-sm line-through opacity-40">{log.old_value}</td>
                      <td className="px-8 py-4 text-sm font-bold text-green-600">{log.new_value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* New Type Modal */}
      <AnimatePresence>
        {showTypeForm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-[#141414]/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-y-auto max-h-[90vh]"
            >
              <div className="p-10">
                <div className="flex justify-between items-center mb-8">
                  <h3 className="text-2xl font-bold">New Vehicle Type</h3>
                  <button onClick={() => setShowTypeForm(false)} className="p-2 hover:bg-[#F5F5F0] rounded-full transition-colors">
                    <XCircle className="w-6 h-6 opacity-30" />
                  </button>
                </div>

                <form onSubmit={handleCreateType} className="space-y-6">
                  {msg.text && (
                    <div className={`p-4 rounded-2xl text-sm flex items-center gap-3 ${msg.type === 'success' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                      {msg.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                      {msg.text}
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest opacity-40 ml-4">Type Name</label>
                    <select 
                      required
                      className="w-full px-6 py-4 bg-[#F5F5F0] rounded-2xl outline-none appearance-none"
                      value={typeData.type}
                      onChange={(e) => setTypeData({ ...typeData, type: e.target.value })}
                    >
                      <option value="">Select Type</option>
                      {VEHICLE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest opacity-40 ml-4">Fuel Limit (Liters)</label>
                    <input 
                      type="number" 
                      step="0.1"
                      required
                      className="w-full px-6 py-4 bg-[#F5F5F0] rounded-2xl outline-none"
                      value={typeData.fuel_limit}
                      onChange={(e) => setTypeData({ ...typeData, fuel_limit: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest opacity-40 ml-4">Limit Period</label>
                    <select 
                      className="w-full px-6 py-4 bg-[#F5F5F0] rounded-2xl outline-none appearance-none"
                      value={typeData.limit_period}
                      onChange={(e) => setTypeData({ ...typeData, limit_period: e.target.value as any })}
                    >
                      <option value="day">Per Day</option>
                      <option value="week">Per Week</option>
                      <option value="month">Per Month</option>
                    </select>
                  </div>

                  <button 
                    type="submit"
                    className="w-full py-5 bg-[#141414] text-white rounded-2xl font-bold text-lg hover:bg-opacity-90 transition-all"
                  >
                    Create Type
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* New Station Modal */}
      <AnimatePresence>
        {showStationForm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-[#141414]/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl"
            >
              <div className="p-10">
                <div className="flex justify-between items-center mb-8">
                  <h3 className="text-2xl font-bold">New Fuel Station</h3>
                  <button onClick={() => setShowStationForm(false)} className="p-2 hover:bg-[#F5F5F0] rounded-full transition-colors">
                    <XCircle className="w-6 h-6 opacity-30" />
                  </button>
                </div>

                <form onSubmit={handleCreateStation} className="space-y-6">
                  {msg.text && (
                    <div className={`p-4 rounded-2xl text-sm flex items-center gap-3 ${msg.type === 'success' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                      {msg.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                      {msg.text}
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest opacity-40 ml-4">Station Name</label>
                    <input 
                      type="text" 
                      required
                      className="w-full px-6 py-4 bg-[#F5F5F0] rounded-2xl outline-none"
                      value={stationData.name}
                      onChange={(e) => setStationData({ ...stationData, name: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest opacity-40 ml-4">Location</label>
                    <input 
                      type="text" 
                      required
                      className="w-full px-6 py-4 bg-[#F5F5F0] rounded-2xl outline-none"
                      value={stationData.location}
                      onChange={(e) => setStationData({ ...stationData, location: e.target.value })}
                    />
                  </div>

                  <button 
                    type="submit"
                    className="w-full py-5 bg-[#141414] text-white rounded-2xl font-bold text-lg hover:bg-opacity-90 transition-all"
                  >
                    Create Station
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add User Modal */}
      <AnimatePresence>
        {showFuelForm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-[#141414]/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl"
            >
              <div className="p-10">
                <div className="flex justify-between items-center mb-8">
                  <h3 className="text-2xl font-bold">Distribute Fuel</h3>
                  <button onClick={() => setShowFuelForm(false)} className="p-2 hover:bg-[#F5F5F0] rounded-full transition-colors">
                    <XCircle className="w-6 h-6 opacity-30" />
                  </button>
                </div>
                <form onSubmit={handleAddFuel} className="space-y-6">
                  {msg.text && (
                    <div className={`p-4 rounded-2xl text-sm flex items-center gap-3 ${msg.type === 'success' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                      {msg.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                      {msg.text}
                    </div>
                  )}
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest opacity-40 ml-4">Station</label>
                    <select 
                      required
                      className="w-full px-6 py-4 bg-[#F5F5F0] rounded-2xl outline-none appearance-none"
                      value={fuelData.station_id}
                      onChange={(e) => setFuelData({ ...fuelData, station_id: e.target.value })}
                    >
                      <option value="">Select Station</option>
                      {stations.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest opacity-40 ml-4">Fuel Type</label>
                    <select 
                      required
                      className="w-full px-6 py-4 bg-[#F5F5F0] rounded-2xl outline-none appearance-none"
                      value={fuelData.fuel_type}
                      onChange={(e) => setFuelData({ ...fuelData, fuel_type: e.target.value })}
                    >
                      <option value="Petrol 92">Petrol 92</option>
                      <option value="Petrol 95">Petrol 95</option>
                      <option value="Diesel">Diesel</option>
                      <option value="Super Diesel">Super Diesel</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest opacity-40 ml-4">Amount (Liters)</label>
                    <input 
                      type="number" 
                      step="0.1"
                      required
                      className="w-full px-6 py-4 bg-[#F5F5F0] rounded-2xl outline-none text-2xl font-bold"
                      value={fuelData.amount}
                      onChange={(e) => setFuelData({ ...fuelData, amount: e.target.value })}
                    />
                  </div>
                  <button type="submit" className="w-full py-5 bg-[#141414] text-white rounded-2xl font-bold text-lg">Add Fuel to Station</button>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showUserForm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-[#141414]/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-y-auto max-h-[90vh]"
            >
              <div className="p-10">
                <div className="flex justify-between items-center mb-8">
                  <h3 className="text-2xl font-bold">Add New User</h3>
                  <button onClick={() => setShowUserForm(false)} className="p-2 hover:bg-[#F5F5F0] rounded-full transition-colors">
                    <XCircle className="w-6 h-6 opacity-30" />
                  </button>
                </div>

                <form onSubmit={handleCreateUser} className="space-y-6">
                  {msg.text && (
                    <div className={`p-4 rounded-2xl text-sm flex items-center gap-3 ${msg.type === 'success' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                      {msg.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                      {msg.text}
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest opacity-40 ml-4">Username</label>
                    <input 
                      type="text" 
                      required
                      className="w-full px-6 py-4 bg-[#F5F5F0] rounded-2xl outline-none"
                      value={userData.username}
                      onChange={(e) => setUserData({ ...userData, username: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest opacity-40 ml-4">Password</label>
                    <input 
                      type="password" 
                      required
                      minLength={6}
                      className="w-full px-6 py-4 bg-[#F5F5F0] rounded-2xl outline-none"
                      value={userData.password}
                      onChange={(e) => setUserData({ ...userData, password: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest opacity-40 ml-4">Full Name</label>
                    <input 
                      type="text" 
                      required
                      className="w-full px-6 py-4 bg-[#F5F5F0] rounded-2xl outline-none"
                      value={userData.full_name}
                      onChange={(e) => setUserData({ ...userData, full_name: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest opacity-40 ml-4">Role</label>
                    <select 
                      className="w-full px-6 py-4 bg-[#F5F5F0] rounded-2xl outline-none appearance-none"
                      value={userData.role}
                      onChange={(e) => setUserData({ ...userData, role: e.target.value })}
                    >
                      <option value="agent">Pumping Agent</option>
                      <option value="manager">Station Manager</option>
                      <option value="admin">Administrator</option>
                    </select>
                  </div>

                  {(userData.role === 'agent' || userData.role === 'manager') && (
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-widest opacity-40 ml-4">Fuel Station</label>
                      <select 
                        required
                        className="w-full px-6 py-4 bg-[#F5F5F0] rounded-2xl outline-none appearance-none"
                        value={userData.station_id}
                        onChange={(e) => setUserData({ ...userData, station_id: e.target.value })}
                      >
                        <option value="">Select a station</option>
                        {stations.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                  )}

                  <button 
                    type="submit"
                    className="w-full py-5 bg-[#141414] text-white rounded-2xl font-bold text-lg hover:bg-opacity-90 transition-all"
                  >
                    Create User
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
