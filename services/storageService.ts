/**
 * Firebase Storage Service
 * Handles image uploads and downloads for pothole reports
 */

import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from './firebase';

/**
 * Upload image to Firebase Storage
 * @param image - File object from input
 * @param userId - User ID for folder organization
 * @returns Download URL
 */
export async function uploadImageToStorage(image: File, userId: string): Promise<string> {
  try {
    // Create a unique filename
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const filename = `${timestamp}_${randomString}.jpg`;
    
    // Create storage reference
    const storageRef = ref(storage, `pothole-images/${userId}/${filename}`);
    
    // Upload file
    const snapshot = await uploadBytes(storageRef, image, {
      contentType: 'image/jpeg'
    });
    
    // Get download URL
    const downloadURL = await getDownloadURL(snapshot.ref);
    
    console.log('✅ Image uploaded successfully:', downloadURL);
    return downloadURL;
  } catch (error) {
    console.error('❌ Error uploading image to storage:', error);
    throw error;
  }
}

/**
 * Upload thumbnail to Firebase Storage
 * @param image - File object (should be resized before calling)
 * @param userId - User ID
 * @returns Download URL
 */
export async function uploadThumbnailToStorage(image: File, userId: string): Promise<string> {
  try {
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const filename = `${timestamp}_${randomString}_thumb.jpg`;
    
    const storageRef = ref(storage, `pothole-thumbnails/${userId}/${filename}`);
    
    const snapshot = await uploadBytes(storageRef, image, {
      contentType: 'image/jpeg'
    });
    
    const downloadURL = await getDownloadURL(snapshot.ref);
    
    console.log('✅ Thumbnail uploaded successfully:', downloadURL);
    return downloadURL;
  } catch (error) {
    console.error('❌ Error uploading thumbnail:', error);
    throw error;
  }
}

/**
 * Delete image from Firebase Storage
 * @param imageUrl - Full URL or storage path
 */
export async function deleteImageFromStorage(imageUrl: string): Promise<void> {
  try {
    // Extract path from URL if needed
    let path = imageUrl;
    if (imageUrl.includes('firebasestorage')) {
      // Extract path from Firebase Storage URL
      const urlParts = imageUrl.split('/');
      const bucketIndex = urlParts.findIndex(part => part.includes('appspot.com'));
      if (bucketIndex !== -1) {
        path = urlParts.slice(bucketIndex + 1).join('/');
      }
    }
    
    const storageRef = ref(storage, path);
    await deleteObject(storageRef);
    
    console.log('✅ Image deleted successfully:', path);
  } catch (error) {
    console.error('❌ Error deleting image:', error);
    throw error;
  }
}

/**
 * Upload user avatar
 * @param image - File object
 * @param userId - User ID
 * @returns Download URL
 */
export async function uploadUserAvatar(image: File, userId: string): Promise<string> {
  try {
    const storageRef = ref(storage, `user-avatars/${userId}/avatar.jpg`);
    
    const snapshot = await uploadBytes(storageRef, image, {
      contentType: 'image/jpeg'
    });
    
    const downloadURL = await getDownloadURL(snapshot.ref);
    
    console.log('✅ Avatar uploaded successfully:', downloadURL);
    return downloadURL;
  } catch (error) {
    console.error('❌ Error uploading avatar:', error);
    throw error;
  }
}

/**
 * Get image dimensions
 * @param file - Image file
 * @returns Object with width and height
 */
export function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.width, height: img.height });
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Resize image (client-side)
 * @param file - Image file
 * @param maxWidth - Maximum width
 * @param maxHeight - Maximum height
 * @returns Resized File object
 */
export async function resizeImage(
  file: File,
  maxWidth: number = 1024,
  maxHeight: number = 1024
): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }
      
      let { width, height } = img;
      
      // Calculate new dimensions
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width *= ratio;
        height *= ratio;
      }
      
      canvas.width = width;
      canvas.height = height;
      
      ctx.drawImage(img, 0, 0, width, height);
      
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Could not create blob'));
            return;
          }
          
          const resizedFile = new File([blob], file.name, {
            type: 'image/jpeg',
            lastModified: Date.now()
          });
          
          resolve(resizedFile);
        },
        'image/jpeg',
        0.85 // Quality
      );
    };
    
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Upload image with optional thumbnail
 * @param image - Original image file
 * @param userId - User ID
 * @param createThumbnail - Whether to create and upload thumbnail
 * @returns Object with original and thumbnail URLs
 */
export async function uploadImageWithThumbnail(
  image: File,
  userId: string,
  createThumbnail: boolean = true
): Promise<{ imageUrl: string; thumbnailUrl?: string }> {
  try {
    // Upload original image
    const imageUrl = await uploadImageToStorage(image, userId);
    
    let thumbnailUrl: string | undefined;
    
    if (createThumbnail) {
      // Resize image for thumbnail
      const thumbnail = await resizeImage(image, 500, 500);
      thumbnailUrl = await uploadThumbnailToStorage(thumbnail, userId);
    }
    
    return { imageUrl, thumbnailUrl };
  } catch (error) {
    console.error('❌ Error uploading image with thumbnail:', error);
    throw error;
  }
}
