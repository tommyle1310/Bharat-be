# Response Utility

This utility provides standardized API response functions for consistent frontend integration.

## Response Format

All API responses follow this standardized format:

```typescript
{
  message: string;    // Human-readable message
  code: number;       // Error code (0 for success, 1+ for errors)
  data: any;          // Response data (optional)
}
```

## Error Code System

- **0**: Success
- **1**: General error
- **2**: Resource not found (e.g., vehicle not found)
- **3**: Authentication required (unauthorized)
- **4**: Access denied (forbidden - e.g., no access to bid)
- **5**: Internal server error
- **6**: Validation failed (e.g., missing required fields)
- **7**: Business rule violation (e.g., bid too high, insufficient bid difference)

## Available Functions

### Core Function
- `sendResponse(res, httpStatus, errorCode, message, data?)` - Main function for custom responses

### Helper Functions
- `sendSuccess(res, message?, data?)` - Code: 0 (Success)
- `sendError(res, message?, data?)` - Code: 1 (General error)
- `sendNotFound(res, message?, data?)` - Code: 2 (Resource not found)
- `sendUnauthorized(res, message?, data?)` - Code: 3 (Authentication required)
- `sendForbidden(res, message?, data?)` - Code: 4 (Access denied)
- `sendInternalError(res, message?, data?)` - Code: 5 (Server error)
- `sendCreated(res, message?, data?)` - Code: 0 (Success)
- `sendNoContent(res, message?, data?)` - Code: 0 (Success)
- `sendValidationError(res, message?, data?)` - Code: 6 (Validation failed)
- `sendBusinessError(res, message?, data?)` - Code: 7 (Business rule violation)

## Usage Examples

```typescript
import { sendSuccess, sendValidationError, sendNotFound, sendBusinessError } from '../../utils/response';

// Success response
return sendSuccess(res, 'Data retrieved successfully', data);

// Validation error
return sendValidationError(res, 'Invalid input parameters');

// Not found response
return sendNotFound(res, 'Vehicle not found');

// Business rule violation
return sendBusinessError(res, 'Bid amount too high');

// Custom error code
return sendResponse(res, 400, 8, 'Custom error', { details: '...' });
```

## Frontend Integration

The frontend can now consistently handle responses by checking the `code` field:

```javascript
// Example frontend handling
fetch('/api/vehicles')
  .then(response => response.json())
  .then(data => {
    switch (data.code) {
      case 0:
        // Success - use data.data
        console.log('Success:', data.message);
        displayVehicles(data.data);
        break;
      case 2:
        // Vehicle not found
        showNotFound(data.message);
        break;
      case 4:
        // No access to bid
        showAccessDenied(data.message);
        break;
      case 6:
        // Validation error - missing fields
        showValidationError(data.message);
        break;
      case 7:
        // Business rule violation
        showBusinessError(data.message);
        break;
      default:
        // General error
        showError(data.message);
    }
  });
```

## Benefits

1. **Consistency**: All API responses follow the same format
2. **Frontend-Friendly**: Easy to map status codes to UI actions
3. **Maintainable**: Centralized response handling
4. **Type-Safe**: TypeScript interfaces ensure proper usage
5. **Extensible**: Easy to add new response types
