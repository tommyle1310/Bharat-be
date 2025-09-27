import { Response } from 'express';

export interface ApiResponse {
  message: string;
  code: number;  // Error code (1, 2, 3, etc.) - 0 for success
  data: any;
}

/**
 * Standardized API response utility function
 * @param res - Express Response object
 * @param httpStatus - HTTP status code (200, 400, 404, 500, etc.)
 * @param errorCode - Error code (0 for success, 1+ for errors)
 * @param message - Response message
 * @param data - Response data (optional)
 * @returns Express Response with standardized format
 */
export function sendResponse(
  res: Response,
  httpStatus: number,
  errorCode: number,
  message: string,
  data: any = null
): Response {
  const response: ApiResponse = {
    message,
    code: errorCode,
    data
  };
  
  return res.status(httpStatus).json(response);
}

/**
 * Success response helper (code: 0)
 * @param res - Express Response object
 * @param message - Success message
 * @param data - Response data (optional)
 */
export function sendSuccess(
  res: Response,
  message: string = 'Success',
  data: any = null
): Response {
  return sendResponse(res, 200, 0, message, data);
}

/**
 * Error response helper (code: 1 - General error)
 * @param res - Express Response object
 * @param message - Error message
 * @param data - Additional error data (optional)
 */
export function sendError(
  res: Response,
  message: string = 'Bad Request',
  data: any = null
): Response {
  return sendResponse(res, 400, 1, message, data);
}

/**
 * Not found response helper (code: 2 - Resource not found)
 * @param res - Express Response object
 * @param message - Not found message
 * @param data - Additional data (optional)
 */
export function sendNotFound(
  res: Response,
  message: string = 'Not Found',
  data: any = null
): Response {
  return sendResponse(res, 404, 2, message, data);
}

/**
 * Unauthorized response helper (code: 3 - Authentication required)
 * @param res - Express Response object
 * @param message - Unauthorized message
 * @param data - Additional data (optional)
 */
export function sendUnauthorized(
  res: Response,
  message: string = 'Unauthorized',
  data: any = null
): Response {
  return sendResponse(res, 401, 3, message, data);
}

/**
 * Forbidden response helper (code: 4 - Access denied)
 * @param res - Express Response object
 * @param message - Forbidden message
 * @param data - Additional data (optional)
 */
export function sendForbidden(
  res: Response,
  message: string = 'Forbidden',
  data: any = null
): Response {
  return sendResponse(res, 403, 4, message, data);
}

/**
 * Internal server error response helper (code: 5 - Server error)
 * @param res - Express Response object
 * @param message - Error message
 * @param data - Additional error data (optional)
 */
export function sendInternalError(
  res: Response,
  message: string = 'Internal Server Error',
  data: any = null
): Response {
  return sendResponse(res, 500, 5, message, data);
}

/**
 * Created response helper (code: 0 - Success)
 * @param res - Express Response object
 * @param message - Created message
 * @param data - Response data (optional)
 */
export function sendCreated(
  res: Response,
  message: string = 'Created',
  data: any = null
): Response {
  return sendResponse(res, 201, 0, message, data);
}

/**
 * No content response helper (code: 0 - Success)
 * @param res - Express Response object
 * @param message - No content message
 * @param data - Additional data (optional)
 */
export function sendNoContent(
  res: Response,
  message: string = 'No Content',
  data: any = null
): Response {
  return sendResponse(res, 204, 0, message, data);
}

/**
 * Validation error response helper (code: 6 - Validation failed)
 * @param res - Express Response object
 * @param message - Validation error message
 * @param data - Additional validation data (optional)
 */
export function sendValidationError(
  res: Response,
  message: string = 'Validation Failed',
  data: any = null
): Response {
  return sendResponse(res, 400, 6, message, data);
}

/**
 * Business logic error response helper (code: 7 - Business rule violation)
 * @param res - Express Response object
 * @param message - Business error message
 * @param data - Additional business error data (optional)
 */
export function sendBusinessError(
  res: Response,
  message: string = 'Business Rule Violation',
  data: any = null
): Response {
  return sendResponse(res, 400, 7, message, data);
}
