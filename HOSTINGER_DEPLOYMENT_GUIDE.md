# Hostinger Deployment Guide - Sandesh Invitation Manager

## ✅ Repository Updated Successfully

**Git Repository:** `github.com/prfful/sandesh-invitation-manager`  
**Deployment Target:** `seagreen-woodcock-382393.hostingersite.com`  
**Latest Commit:** Deploy configuration with .htaccess and rebuilt frontend

---

## 🚀 Hostinger Deployment Steps

### Step 1: Connect Git Repository to Hostinger

1. **Log in to Hostinger Control Panel (hPanel)**
   - Go to https://hpanel.hostinger.com/
   - Select your hosting account for `seagreen-woodcock-382393.hostingersite.com`

2. **Navigate to Git Settings**
   - Go to: **Advanced** → **Git** (or search for "Git" in hPanel)
   - Click **"Create New Repository"** or **"Connect Repository"**

3. **Configure Git Deployment**
   - **Repository URL:** `https://github.com/prfful/sandesh-invitation-manager.git`
   - **Branch:** `main`
   - **Target Path:** `/home/u590837060/domains/seagreen-woodcock-382393.hostingersite.com/public_html`
   - Click **"Create"** or **"Connect"**

4. **Deploy Repository**
   - After connecting, click **"Pull"** or **"Deploy"** button
   - Wait for deployment to complete (shows success message)

---

### Step 2: Configure Environment Variables

1. **In Hostinger hPanel:**
   - Go to **Advanced** → **File Manager**
   - Navigate to: `/home/u590837060/domains/seagreen-woodcock-382393.hostingersite.com/public_html`

2. **Create `.env` file** (if not exists):
   ```bash
   DB_HOST=127.0.0.1
   DB_PORT=3306
   DB_USER=u590837060_sandeshuser
   DB_PASSWORD=Dharfc@232111#website
   DB_NAME=u590837060_sandesh_data
   NODE_ENV=production
   PORT=3000
   ```

   **Note:** Use the credentials from `.env.hostinger` file or your actual Hostinger MySQL credentials.

3. **Verify `.htaccess` file exists** with Passenger configuration:
   ```apache
   PassengerAppRoot /home/u590837060/domains/seagreen-woodcock-382393.hostingersite.com/public_html
   PassengerAppType node
   PassengerNodejs /opt/alt/alt-nodejs24/root/bin/node
   PassengerStartupFile server.js
   PassengerBaseURI /
   ```

---

### Step 3: Install Dependencies

1. **Open SSH Terminal in Hostinger:**
   - Go to **Advanced** → **SSH Access**
   - Enable SSH if not already enabled
   - Use provided SSH credentials to connect

2. **Navigate to deployment directory:**
   ```bash
   cd /home/u590837060/domains/seagreen-woodcock-382393.hostingersite.com/public_html
   ```

3. **Install Node.js dependencies:**
   ```bash
   npm install --production
   ```

4. **Verify installation:**
   ```bash
   ls -la
   node --version
   npm --version
   ```

---

### Step 4: Restart Application

**Option A: Via hPanel (Recommended)**
- Go to **Advanced** → **Passenger**
- Find your application: `seagreen-woodcock-382393.hostingersite.com`
- Click **"Restart Application"**

**Option B: Via SSH**
```bash
cd /home/u590837060/domains/seagreen-woodcock-382393.hostingersite.com/public_html
touch tmp/restart.txt
```

**Option C: Via File Manager**
- Navigate to `public_html/tmp/` directory
- Create or update file: `restart.txt`
- This triggers Passenger to restart the app

---

### Step 5: Verify Deployment

1. **Check website:** https://seagreen-woodcock-382393.hostingersite.com/
   - Should show Sandesh Invitation Manager interface
   - Login page should load properly

2. **Check API endpoint:**
   - https://seagreen-woodcock-382393.hostingersite.com/api/entities/ProgramType
   - Should return JSON response

3. **Test database connection:**
   - Try logging in with operator credentials
   - Check if data loads on Dashboard

4. **Check error logs** (if issues occur):
   - Via hPanel: **Advanced** → **Error Logs**
   - Via SSH: `tail -f /home/u590837060/logs/error.log`

---

## 🔄 Future Updates

### For quick updates after code changes:

1. **Commit and push changes locally:**
   ```bash
   cd d:\prfful\project\sandesh-webportal\sandesh-invitation-manager
   
   # Make your changes, then:
   git add .
   git commit -m "Your descriptive message"
   git push origin main
   ```

2. **Deploy on Hostinger:**
   - Go to hPanel → **Git**
   - Click **"Pull"** next to your repository
   - Wait for deployment
   - Restart application (touch `tmp/restart.txt` or use Passenger restart)

---

## 📁 Required Files in Repository

✅ All files are now in the repository:
- ✅ `server.js` - Backend API server
- ✅ `package.json` - Dependencies and scripts
- ✅ `.htaccess` - Hostinger Passenger configuration
- ✅ `fronthend/dist/` - Built frontend files
- ✅ `.env` - Environment variables (use .env.hostinger as reference)
- ✅ `uploads/` directory - File storage (create if missing)

---

## 🆘 Troubleshooting

### Issue: Website shows 500 Internal Server Error
**Solution:**
1. Check error logs in hPanel
2. Verify `.env` file exists with correct database credentials
3. Restart application: `touch tmp/restart.txt`
4. Check Node.js version: `node --version` (should be v20+)

### Issue: Database connection fails
**Solution:**
1. Verify database credentials in `.env`
2. Check MySQL service is running in hPanel
3. Test connection via phpMyAdmin
4. Ensure database user has proper permissions

### Issue: Frontend not loading
**Solution:**
1. Verify `fronthend/dist/` directory exists and has files
2. Check server.js console logs for frontend path
3. Rebuild frontend: `npm run build`
4. Redeploy via Git pull

### Issue: File uploads not working
**Solution:**
1. Create `uploads/` directory if missing:
   ```bash
   mkdir -p uploads
   chmod 755 uploads
   ```
2. Check folder permissions: `ls -la uploads/`
3. Verify multer configuration in server.js

---

## 📞 Support

- **Hostinger Support:** https://www.hostinger.com/contact
- **Git Repository:** https://github.com/prfful/sandesh-invitation-manager
- **Project Documentation:** See README.md and other docs in repository

---

## ⚠️ Important Notes

1. **Never deploy to wrong repository!**
   - **Sandesh project:** `seagreen-woodcock-382393.hostingersite.com` 
   - **Neena Verma portal:** `neenavikramverma.in` (separate Git repo)

2. **Database Security:**
   - Keep `.env` file secure
   - Never commit sensitive passwords to Git
   - Use `.env.local` for local development

3. **Performance:**
   - Frontend is pre-built (faster loading)
   - Node.js Passenger app restarts automatically
   - Check Passenger logs for memory/performance issues

---

**Last Updated:** February 24, 2026  
**Version:** 1.0  
**Status:** ✅ Ready for Deployment
