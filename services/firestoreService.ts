import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  limit,
  Timestamp,
  GeoPoint,
  WhereFilterOp,
  addDoc
} from 'firebase/firestore';
import { db } from './firebase';

// Define your pothole report type
export interface PotholeReport {
  id?: string;
  userId: string;
  location: {
    latitude: number;
    longitude: number;
    geopoint: GeoPoint;
    address?: string;
  };
  roadInfo: {
    type: 'NH' | 'SH' | 'MAIN' | 'STREET' | 'VILLAGE';
    name?: string;
    importance: number; // 1-5 weight
  };
  severity: {
    score: number; // 0-10
    area: number; // pothole area in sq meters
    confidence: number; // AI confidence 0-1
  };
  detection: {
    boundingBox: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
    imageUrl: string;
    thumbnailUrl?: string;
  };
  status: 'reported' | 'verified' | 'in_progress' | 'repaired' | 'rejected';
  metadata: {
    reportedAt: Timestamp;
    verifiedAt?: Timestamp;
    repairedAt?: Timestamp;
    assignedTo?: string; // contractor ID
  };
  userInfo?: {
    name?: string;
    phone?: string;
  };
}

export class FirestoreService {
  // Collection references
  static readonly COLLECTIONS = {
    POTHOLES: 'potholes',
    USERS: 'users',
    CONTRACTORS: 'contractors',
    ANALYTICS: 'analytics',
    ADMIN_LOGS: 'adminLogs'
  };

  // Create pothole report
  static async createPotholeReport(report: Omit<PotholeReport, 'id'>): Promise<string> {
    try {
      const docRef = await addDoc(
        collection(db, this.COLLECTIONS.POTHOLES), 
        {
          ...report,
          metadata: {
            ...report.metadata,
            reportedAt: Timestamp.now()
          }
        }
      );
      console.log('Pothole report created:', docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('Error creating pothole report:', error);
      throw error;
    }
  }

  // Get single pothole report
  static async getPotholeReport(reportId: string): Promise<PotholeReport | null> {
    try {
      const docRef = doc(db, this.COLLECTIONS.POTHOLES, reportId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as PotholeReport;
      }
      return null;
    } catch (error) {
      console.error('Error fetching pothole report:', error);
      throw error;
    }
  }

  // Query potholes by severity
  static async getPotholesBySeverity(minSeverity: number): Promise<PotholeReport[]> {
    try {
      const q = query(
        collection(db, this.COLLECTIONS.POTHOLES),
        where('severity.score', '>=', minSeverity),
        orderBy('severity.score', 'desc'),
        limit(50)
      );
      
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as PotholeReport[];
    } catch (error) {
      console.error('Error querying potholes by severity:', error);
      throw error;
    }
  }

  // Query potholes by road type
  static async getPotholesByRoadType(roadType: string): Promise<PotholeReport[]> {
    try {
      const q = query(
        collection(db, this.COLLECTIONS.POTHOLES),
        where('roadInfo.type', '==', roadType),
        orderBy('metadata.reportedAt', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as PotholeReport[];
    } catch (error) {
      console.error('Error querying potholes by road type:', error);
      throw error;
    }
  }

  // Query potholes by status
  static async getPotholesByStatus(status: PotholeReport['status']): Promise<PotholeReport[]> {
    try {
      const q = query(
        collection(db, this.COLLECTIONS.POTHOLES),
        where('status', '==', status),
        orderBy('metadata.reportedAt', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as PotholeReport[];
    } catch (error) {
      console.error('Error querying potholes by status:', error);
      throw error;
    }
  }

  // Update pothole status
  static async updatePotholeStatus(
    reportId: string, 
    status: PotholeReport['status'],
    additionalData?: Partial<PotholeReport>
  ): Promise<void> {
    try {
      const docRef = doc(db, this.COLLECTIONS.POTHOLES, reportId);
      await updateDoc(docRef, {
        status,
        ...additionalData,
        [`metadata.${status}At`]: Timestamp.now()
      });
      console.log('Pothole status updated');
    } catch (error) {
      console.error('Error updating pothole status:', error);
      throw error;
    }
  }

  // Delete pothole report
  static async deletePotholeReport(reportId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, this.COLLECTIONS.POTHOLES, reportId));
      console.log('Pothole report deleted');
    } catch (error) {
      console.error('Error deleting pothole report:', error);
      throw error;
    }
  }

  // Get all potholes (with pagination)
  static async getAllPotholes(limitCount: number = 20): Promise<PotholeReport[]> {
    try {
      const q = query(
        collection(db, this.COLLECTIONS.POTHOLES),
        orderBy('metadata.reportedAt', 'desc'),
        limit(limitCount)
      );
      
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as PotholeReport[];
    } catch (error) {
      console.error('Error fetching all potholes:', error);
      throw error;
    }
  }

  // Generic query builder for complex queries
  static async customQuery(
    collectionName: string,
    conditions: Array<{ field: string; operator: WhereFilterOp; value: any }>,
    orderByField?: string,
    limitCount?: number
  ): Promise<any[]> {
    try {
      let q = collection(db, collectionName);
      let queryRef: any = q;

      conditions.forEach(condition => {
        queryRef = query(queryRef, where(condition.field, condition.operator, condition.value));
      });

      if (orderByField) {
        queryRef = query(queryRef, orderBy(orderByField, 'desc'));
      }

      if (limitCount) {
        queryRef = query(queryRef, limit(limitCount));
      }

      const querySnapshot = await getDocs(queryRef);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error executing custom query:', error);
      throw error;
    }
  }

  // Create or update user document
  static async createUserDocument(userData: any): Promise<void> {
    try {
      const userRef = doc(db, this.COLLECTIONS.USERS, userData.id);
      await setDoc(userRef, userData, { merge: true });
      console.log('User document created/updated:', userData.id);
    } catch (error) {
      console.error('Error creating user document:', error);
      throw error;
    }
  }

  // Get user document
  static async getUserDocument(userId: string): Promise<any | null> {
    try {
      const userRef = doc(db, this.COLLECTIONS.USERS, userId);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {
        return { id: userSnap.id, ...userSnap.data() };
      }
      return null;
    } catch (error) {
      console.error('Error fetching user document:', error);
      throw error;
    }
  }

  // Log admin activity
  static async logAdminActivity(type: string, details?: string): Promise<void> {
    try {
      const logRef = await addDoc(collection(db, this.COLLECTIONS.ADMIN_LOGS), {
        type,
        details,
        timestamp: Timestamp.now()
      });
      console.log('Admin activity logged:', logRef.id);
    } catch (error) {
      console.error('Error logging admin activity:', error);
      throw error;
    }
  }
}