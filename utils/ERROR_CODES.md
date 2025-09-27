# Error Code Reference

This document provides a complete reference for all error codes used in the API responses.

## Error Code System

| Code | Name | Description | HTTP Status | Usage Example |
|------|------|-------------|-------------|---------------|
| 0 | Success | Operation completed successfully | 200/201/204 | Data retrieved, resource created |
| 1 | General Error | Generic error condition | 400 | Unexpected errors |
| 2 | Not Found | Resource not found | 404 | Vehicle not found, auto bid not found |
| 3 | Unauthorized | Authentication required | 401 | User not logged in |
| 4 | Forbidden | Access denied | 403 | No access to bid on vehicle |
| 5 | Internal Error | Server error | 500 | Database connection failed |
| 6 | Validation Error | Input validation failed | 400 | Missing required fields, invalid IDs |
| 7 | Business Error | Business rule violation | 400 | Bid too high, insufficient bid difference |

## Frontend Mapping Examples

### Success Cases (Code: 0)
```javascript
if (response.code === 0) {
  // Show success message
  showSuccess(response.message);
  // Use the data
  displayData(response.data);
}
```

### Error Cases
```javascript
switch (response.code) {
  case 2: // Not Found
    showNotFoundDialog(response.message);
    break;
    
  case 3: // Unauthorized
    redirectToLogin();
    break;
    
  case 4: // Forbidden
    showAccessDeniedDialog(response.message);
    break;
    
  case 6: // Validation Error
    highlightInvalidFields(response.data);
    showValidationMessage(response.message);
    break;
    
  case 7: // Business Error
    showBusinessRuleViolation(response.message);
    break;
    
  default: // General Error (1) or Internal Error (5)
    showGenericError(response.message);
}
```

## Specific Use Cases

### Vehicle Operations
- **Code 2**: Vehicle not found
- **Code 6**: Invalid vehicle ID format

### Bidding Operations
- **Code 4**: No access to bid on vehicle
- **Code 6**: Missing buyer_id, vehicle_id, or bid_amount
- **Code 7**: Bid too high, bid too low, insufficient bid difference

### Auto Bid Operations
- **Code 2**: Auto bid not found, Vehicle not found
- **Code 3**: Buyer authentication required
- **Code 6**: Invalid parameters (start_amount, max_bid, step_amount)
- **Code 7**: 
  - Bid difference must be at least 1000
  - Start amount did not reach base price
  - Max bid amount exceeds vehicle maximum price
  - Step amount must be at least 1000

### Watchlist/Wishlist Operations
- **Code 6**: Invalid buyer or vehicle ID

## Response Format

All responses follow this structure:
```json
{
  "message": "Human-readable message",
  "code": 0,
  "data": { /* response data or null */ }
}
```

## Best Practices

1. **Always check the code first** before processing data
2. **Use switch statements** for better code organization
3. **Provide user-friendly messages** based on the code
4. **Handle unknown codes** with a fallback error handler
5. **Log errors** for debugging purposes
