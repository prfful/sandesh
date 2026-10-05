# Sandesh Invitation Manager

Complete invitation management system for Hindu ceremonies (विवाह, गृहप्रवेश, etc.) with letter generation, WhatsApp reminders, and visual report designer.

## 🚀 Features

- **Digital Invitation Management** - Create and manage invitations for various ceremonies
- **Letter Generation** - Professional letter templates with Hindi language support
- **Invitation Card Attachments** - Keep JPEG/PDF cards available until the thank-you letter is marked sent
- **Visual Designer** - Drag-and-drop report designer for custom layouts
- **WhatsApp Integration** - Direct and API-based WhatsApp message sending
- **PDF Generation** - Puppeteer-based PDF export
- **Bulk Operations** - Manage multiple invitations efficiently
- **Operator Management** - Multi-user support with role-based access

## 🏗️ Tech Stack

### Backend
- **Node.js** + **Express.js** - REST API server
- **MySQL** - Database
- **Puppeteer** - PDF generation
- **Multer** - File upload handling

### Frontend
- **React 18** + **Vite** - Fast development experience
- **React Query** (@tanstack/react-query) - Server state management
- **React Router** - Client-side routing
- **shadcn/ui** - Beautiful UI components built on Radix
- **Tailwind CSS** - Utility-first styling
- **Lucide React** - Icons

## 📋 Prerequisites

- **Node.js** 18+ and npm
- **MySQL** 8.0+
- **Git** (for version control)

## 🛠️ Installation

### 1. Clone Repository
```bash
git clone <your-repository-url>
cd sandesh-invitation-manager
```

### 2. Install Dependencies

**Backend:**
```bash
npm install
```

**Frontend:**
```bash
cd fronthend
npm install
cd ..
```

### 3. Database Setup

**Create Database:**
```sql
CREATE DATABASE sandesh_data CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

**Run Schema Scripts:**
```bash
node test-db.js  # Test connection
# Run additional schema update scripts as needed
npm run setup:invitation-card  # Add invitation-card attachment storage to pragram
```

### 4. Environment Configuration

**Create `.env` file in root:**
```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=your_mysql_user
DB_PASSWORD=your_mysql_password
DB_NAME=sandesh_data

PORT=5000
NODE_ENV=development
```

**Create `fronthend/.env.development`:**
```env
VITE_BASE44_API_URL=http://localhost:5000/api
```

⚠️ **Important:** Never commit `.env` files to Git! They're already in `.gitignore`.

## 🚀 Running the Application

### Development Mode

**Terminal 1 - Backend API (port 5000):**
```bash
npm run api
```

**Terminal 2 - Frontend Dev Server (port 5173):**
```bash
npm run frontend:dev
# OR
cd fronthend && npm run dev
```

**Access:** Open browser to `http://localhost:5173`

### Production Build

**Build Frontend:**
```bash
cd fronthend
npm run build
```

**Run Production Server:**
```bash
npm start
```

## 📁 Project Structure

```
sandesh-invitation-manager/
├── server.js                 # Express API server
├── .env                      # Environment variables (not in Git)
├── .env.production          # Production config (not in Git)
├── package.json             # Backend dependencies
├── uploads/                 # User uploaded files
├── fronthend/               # Frontend React app (note: spelling is intentional)
│   ├── src/
│   │   ├── api/             # API client layer
│   │   ├── components/      # Reusable UI components
│   │   ├── pages/           # Page components
│   │   └── utils/           # Utility functions
│   ├── package.json         # Frontend dependencies
│   └── vite.config.js       # Vite configuration
└── *.js                     # Utility scripts for DB management
```

## 📚 Key Components

### Entity-Table Mapping
Frontend entity names differ from database tables. See `ENTITY_TABLES` in `server.js`:
```javascript
ProgramType → programtype
Pragram → pragram           // Note: "Pragram" is intentional
LetterTemplate → lettertemplate
```

### API Architecture
- **Development:** Direct MySQL REST API via Express
- **restClient.js:** Handles all API communication
- **entities.js:** Entity-specific wrappers (list/get/create/update/delete)

### Database Schema
- **pragram** - Main invitation entity (note lowercase)
- **programtype** - Ceremony types (विवाह, गृहप्रवेश, etc.)
- **lettersettings** - Page layout configuration
- **lettertemplate** - Letter content templates
- **appsettings** - Global application settings

## 🔧 Utility Scripts

```bash
node test-db.js                    # Test database connection
node check-program-data.js         # Verify Pragram records
node check-lettersettings.js       # Inspect letter config
node clean-lettersettings.js       # Remove corrupted records
```

## 🌐 Deployment

### Hostinger (or similar shared hosting)

1. **Upload Files:** FTP/SFTP to server
2. **Install Dependencies:** `npm install --production`
3. **Configure Environment:** Create `.env.production` with server DB credentials
4. **Build Frontend:** `cd fronthend && npm run build`
5. **Start Server:** Use PM2 or similar process manager
   ```bash
   npm install -g pm2
   pm2 start server.js --name sandesh-api
   pm2 save
   ```

### Port Configuration
- Backend default: Port 5000 (configurable in `.env`)
- Ensure frontend `VITE_BASE44_API_URL` matches your API URL

## 📝 Key Features Guide

### WhatsApp Integration
Two modes available:
- **Direct Mode:** Opens WhatsApp Web with pre-filled message
- **API Mode:** Sends via third-party API (BHASHSMS compatible)

Configure in Settings → WhatsApp Settings

### Visual Designer
Drag-and-drop interface for custom letter layouts:
1. Design → Visual Designer Tab
2. Add/position elements
3. Generate PDF
4. See `VISUAL_DESIGNER_README.md` for details

### Hindi Text Support
- All UI labels use Devanagari script
- Noto Sans Devanagari font pre-configured
- Database supports UTF-8 (utf8mb4)

## 🤝 Contributing

This is a private project. For internal development:
1. Create feature branch: `git checkout -b feature/new-feature`
2. Make changes and commit: `git commit -m "Add new feature"`
3. Push to remote: `git push origin feature/new-feature`
4. Create Pull Request for review

## 📄 Additional Documentation

- `SETUP_VISUAL_DESIGNER.md` - Visual designer implementation
- `VISUAL_DESIGNER_README.md` - User guide for visual designer
- `AUTHENTICATION_GUIDE.md` - User authentication setup
- `.github/copilot-instructions.md` - Comprehensive development guide

## 🐛 Troubleshooting

**Database Connection Failed:**
- Check MySQL service is running
- Verify `.env` credentials match your MySQL setup
- Test with: `node test-db.js`

**Frontend Shows 404:**
- Ensure backend API is running on correct port
- Check `VITE_BASE44_API_URL` in `fronthend/.env.development`

**Upload Errors:**
- Verify `uploads/` directory exists
- Check write permissions on `uploads/` folder

**PDF Generation Fails:**
- Puppeteer requires system dependencies (Linux)
- Windows: Usually works out-of-box
- Check server console for Chromium errors

## 📞 Support

For issues or questions, contact the development team.

## 📜 License

Proprietary - All rights reserved
