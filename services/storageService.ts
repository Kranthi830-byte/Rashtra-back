import { storage } from './firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

export const StorageService = {
  async uploadPotholeImage(file: File): Promise<string> {
    try {
      const storageRef = ref(storage, `potholes/${Date.now()}_${file.name}`);
      const snapshot = await uploadBytes(storageRef, file);
      // Added 'const' here to fix the red line
      const downloadURL = await getDownloadURL(snapshot.ref);
      return downloadURL;
    } catch (error) {
      console.error("Storage Upload Error:", error);
      throw error;
    }
  }
};