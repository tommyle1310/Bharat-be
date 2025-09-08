# Static Files Configuration

This backend now serves static files from two locations:

## 1. Local Public Directory
- **Path**: `kmsg/backend/public/`
- **URL**: `http://localhost:1310/public/`
- **Use case**: Backend-specific static files

## 2. External Data Files Directory
- **Path**: `kmsg/data-files/` (sibling to backend)
- **URL**: `http://localhost:1310/data-files/`
- **Use case**: Vehicle images, manager photos, and other data files

## Configuration

The static file paths are configured in `config/config.ts`:

```typescript
static: {
  publicPath: path.join(__dirname, '../public'),
  dataFilesPath: process.env.DATA_FILES_PATH || path.join(__dirname, '../../data-files'),
  publicUrl: process.env.PUBLIC_URL || '/public',
  dataFilesUrl: process.env.DATA_FILES_URL || '/data-files',
}
```

## Environment Variables

You can override the default paths using environment variables:

```bash
# .env.development
DATA_FILES_PATH=/path/to/your/data-files
DATA_FILES_URL=/custom-data-files
PUBLIC_URL=/custom-public
```

## Usage Examples

### 1. Accessing Files Directly
```
# Vehicle image
GET http://localhost:1310/data-files/vehicles/123/image1.jpg

# Manager photo
GET http://localhost:1310/data-files/managers/456/profile.jpg

# Public file
GET http://localhost:1310/public/logo.png
```

### 2. Using Utility Functions

```typescript
import { getDataFileUrl, getVehicleImageUrl, getManagerImageUrl } from '../utils/static-files';

// Generate URLs programmatically
const vehicleImageUrl = getVehicleImageUrl(123, 'image1.jpg');
// Returns: /data-files/vehicles/123/image1.jpg

const managerImageUrl = getManagerImageUrl(456, 'profile.jpg');
// Returns: /data-files/managers/456/profile.jpg

const customDataFileUrl = getDataFileUrl('documents/contract.pdf');
// Returns: /data-files/documents/contract.pdf
```

### 3. Directory Structure

```
kmsg/
├── backend/                 # Your backend project
│   ├── public/             # Backend static files
│   │   └── logo.png
│   └── ...
└── data-files/             # External data files
    ├── vehicles/
    │   ├── 123/
    │   │   ├── image1.jpg
    │   │   └── image2.jpg
    │   └── 456/
    │       └── image1.jpg
    ├── managers/
    │   ├── 1/
    │   │   └── profile.jpg
    │   └── 2/
    │       └── profile.jpg
    └── documents/
        └── contract.pdf
```

## Benefits

1. **Separation of Concerns**: Data files are separate from backend code
2. **Scalability**: Easy to move data files to CDN or different storage
3. **Flexibility**: Environment variables allow different paths for different environments
4. **Type Safety**: Utility functions provide type-safe URL generation
5. **Fallback Support**: Default images still work if static files are missing
