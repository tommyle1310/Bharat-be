import { config } from '../config/config';

/**
 * Generate URL for static files from the data-files directory
 * @param filePath - Path to file relative to data-files directory
 * @returns Full URL to access the static file
 */
export function getDataFileUrl(filePath: string): string {
  // Remove leading slash if present
  const cleanPath = filePath.startsWith('/') ? filePath.slice(1) : filePath;
  return `${config.static.dataFilesUrl}/${cleanPath}`;
}

/**
 * Generate URL for static files from the public directory
 * @param filePath - Path to file relative to public directory
 * @returns Full URL to access the static file
 */
export function getPublicFileUrl(filePath: string): string {
  // Remove leading slash if present
  const cleanPath = filePath.startsWith('/') ? filePath.slice(1) : filePath;
  return `${config.static.publicUrl}/${cleanPath}`;
}

/**
 * Generate URL for vehicle images
 * @param vehicleId - Vehicle ID
 * @param imageName - Image filename
 * @returns Full URL to access the vehicle image
 */
export function getVehicleImageUrl(vehicleId: string | number, imageName: string): string {
  return getDataFileUrl(`vehicles/${vehicleId}/${imageName}`);
}

/**
 * Generate URL for manager profile images
 * @param managerId - Manager ID
 * @param imageName - Image filename
 * @returns Full URL to access the manager image
 */
export function getManagerImageUrl(managerId: string | number, imageName: string): string {
  return getDataFileUrl(`managers/${managerId}/${imageName}`);
}

// Default fallback images
export const DEFAULT_IMAGES = {
  VEHICLE: 'https://images.unsplash.com/photo-1517673132405-a56a62b18caf?w=800',
  MANAGER: 'https://images.unsplash.com/photo-1519211975560-4ca611f5a72a?w=800',
} as const;
