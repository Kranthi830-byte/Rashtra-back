import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from './firebase';
import { StorageService } from './storageService';
import { Complaint, ComplaintStatus, Severity, AdminActivityType, AdminLog, AdminStats } from '../types';
import { analyzePotholes } from './model1';
import { analyzeGeneralDamage } from './model2';

type ComplaintDoc = Omit<Complaint, 'id' | 'timestamp'> & {
  timestamp: Timestamp;
};

const toDate = (ts: any): Date => {
  if (!ts) return new Date(0);
  if (typeof ts?.toDate === 'function') return ts.toDate();
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? new Date(0) : d;
};

class FirebaseApiService {
  private readonly COLLECTIONS = {
    COMPLAINTS: 'complaints',
    ADMIN_LOGS: 'adminLogs',
  } as const;

  async getComplaints(): Promise<Complaint[]> {
    const q = query(
      collection(db, this.COLLECTIONS.COMPLAINTS),
      orderBy('timestamp', 'desc'),
      limit(200)
    );

    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const data = d.data() as Partial<ComplaintDoc>;
      return {
        id: d.id,
        userId: String(data.userId ?? ''),
        imageUrl: String(data.imageUrl ?? ''),
        latitude: Number(data.latitude ?? 0),
        longitude: Number(data.longitude ?? 0),
        status: (data.status ?? ComplaintStatus.SUBMITTED) as ComplaintStatus,
        severity: (data.severity ?? Severity.LOW) as Severity,
        severityScore: Number(data.severityScore ?? 0),
        description: data.description,
        timestamp: toDate(data.timestamp),
        address: String(data.address ?? ''),
      } satisfies Complaint;
    });
  }

  async getUserComplaints(userId: string): Promise<Complaint[]> {
    const q = query(
      collection(db, this.COLLECTIONS.COMPLAINTS),
      where('userId', '==', userId),
      orderBy('timestamp', 'desc'),
      limit(200)
    );

    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const data = d.data() as Partial<ComplaintDoc>;
      return {
        id: d.id,
        userId: String(data.userId ?? ''),
        imageUrl: String(data.imageUrl ?? ''),
        latitude: Number(data.latitude ?? 0),
        longitude: Number(data.longitude ?? 0),
        status: (data.status ?? ComplaintStatus.SUBMITTED) as ComplaintStatus,
        severity: (data.severity ?? Severity.LOW) as Severity,
        severityScore: Number(data.severityScore ?? 0),
        description: data.description,
        timestamp: toDate(data.timestamp),
        address: String(data.address ?? ''),
      } satisfies Complaint;
    });
  }

  async logAdminActivity(type: AdminActivityType, details?: string): Promise<void> {
    await addDoc(collection(db, this.COLLECTIONS.ADMIN_LOGS), {
      type,
      details: details ?? '',
      timestamp: Timestamp.now(),
    });
  }

  async getAdminStats(): Promise<AdminStats> {
    const q = query(
      collection(db, this.COLLECTIONS.ADMIN_LOGS),
      orderBy('timestamp', 'desc'),
      limit(200)
    );
    const snap = await getDocs(q);

    const logs: AdminLog[] = snap.docs.map((d) => {
      const data = d.data() as any;
      return {
        id: d.id,
        type: data.type as AdminActivityType,
        timestamp: toDate(data.timestamp),
        details: data.details,
      };
    });

    const totalRepairOrders = logs.filter((l) => l.type === 'REPAIR_ORDER').length;
    const totalDeletedCases = logs.filter((l) => l.type === 'DELETE_CASE').length;

    return {
      totalRepairOrders,
      totalDeletedCases,
      logs,
    };
  }

  // --- AI BACKEND PIPELINE (client-side for now) ---
  // Persists the result into Firestore + uploads the image to Firebase Storage.
  async analyzeAndReport(
    image: File,
    location: { lat: number; lng: number } | null,
    manualAddress: string,
    userId: string,
    onStatusUpdate?: (status: string) => void
  ): Promise<Complaint> {
    onStatusUpdate?.('Uploading evidence...');

    const imageUrl = await StorageService.uploadPotholeImage(image);

    onStatusUpdate?.('Initializing Analysis Pipeline...');

    let address = (manualAddress || '').trim();
    const finalLat = location?.lat ?? 0;
    const finalLng = location?.lng ?? 0;
    if (!address && location) {
      address = `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)} (GPS Detected)`;
    }
    if (!address) address = 'Unknown Location';

    onStatusUpdate?.('Running Model 1 (Pothole Expert)...');
    const potholeResult = await analyzePotholes(image, finalLat, finalLng);

    let status: ComplaintStatus = ComplaintStatus.WAITING_LIST;
    let severity: Severity = Severity.LOW;
    let severityScore = 0;
    let description = '';

    if (potholeResult.detected) {
      onStatusUpdate?.('Model 1 Verified: Pothole Detected!');
      status = ComplaintStatus.AUTO_VERIFIED;
      severity = potholeResult.severity;
      severityScore = potholeResult.severityScore;
      description = potholeResult.label;
    } else {
      onStatusUpdate?.('Model 1 Negative. Escalating to Model 2...');
      const damageResult = await analyzeGeneralDamage(image, finalLat, finalLng);

      if (damageResult.detected) {
        onStatusUpdate?.('Model 2 Verified: General Damage Detected!');
        status = ComplaintStatus.AUTO_VERIFIED;
        severity = damageResult.severity;
        severityScore = damageResult.severityScore;
        description = damageResult.label;
      } else {
        onStatusUpdate?.('No clear damage detected. Moving to Waiting List.');
        status = ComplaintStatus.WAITING_LIST;
        severity = Severity.LOW;
        severityScore = 0.5;
        description = 'No clear damage detected by AI systems. Pending manual review.';
      }
    }

    const payload: ComplaintDoc = {
      userId,
      imageUrl,
      latitude: finalLat,
      longitude: finalLng,
      status,
      severity,
      severityScore,
      description,
      timestamp: Timestamp.now(),
      address,
    };

    onStatusUpdate?.('Saving report...');
    const docRef = await addDoc(collection(db, this.COLLECTIONS.COMPLAINTS), payload);

    return {
      id: docRef.id,
      ...payload,
      timestamp: payload.timestamp.toDate(),
    };
  }

  async updateComplaintStatus(id: string, status: ComplaintStatus): Promise<void> {
    await updateDoc(doc(db, this.COLLECTIONS.COMPLAINTS, id), {
      status,
    });
  }

  async deleteComplaint(id: string): Promise<void> {
    await deleteDoc(doc(db, this.COLLECTIONS.COMPLAINTS, id));
  }
}

export const api = new FirebaseApiService();