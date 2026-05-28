# Smart Controlled File Sharing System (VaultShare)

A secure, modern file-sharing web application with advanced privacy, access control, and real-time analytics.

## Features

- **User Authentication**: Secure JWT-based login and registration.
- **Secure File Upload**: Upload files to Cloudinary seamlessly.
- **Password Protection**: Optional password for file downloads.
- **Smart Expiry**: Set hour-based expiry for shared links.
- **Self-Destruct**: One-time download functionality that automatically revokes access after one use.
- **Access Control & Analytics**: Track IP, Device Type, Timestamp, and Access Reason (Study/Work/Personal) via a real-time Chart.js dashboard.
- **Remote Revoke**: Revoke file access instantly from the dashboard.
- **Modern UI**: Fully responsive glassmorphism design with a dark premium aesthetic.

## Local Setup Instructions

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Configure Environment Variables**
   Open the `.env` file in the root directory and update it with your actual credentials:
   ```env
   CLOUD_NAME=your_cloudinary_cloud_name
   API_KEY=your_cloudinary_api_key
   API_SECRET=your_cloudinary_api_secret
   MONGO_URI=your_mongodb_atlas_connection_string
   JWT_SECRET=your_super_secret_jwt_key
   PORT=3000
   ```

3. **Start the Development Server**
   ```bash
   npm run dev
   ```
   Or for production:
   ```bash
   npm start
   ```

4. **Access the App**
   Open your browser and navigate to `http://localhost:3000`.

## Deployment Guide (Render + MongoDB Atlas)

### 1. MongoDB Atlas Setup
1. Create a free cluster on [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
2. Go to "Database Access" and create a database user (save the username and password).
3. Go to "Network Access" and add IP `0.0.0.0/0` to allow connections from anywhere (Render needs this).
4. Go to "Clusters" -> "Connect" -> "Connect your application" and copy the connection string. Replace `<password>` with your user's password.

### 2. Cloudinary Setup
1. Create a free account on [Cloudinary](https://cloudinary.com/).
2. Go to your Dashboard and copy your `Cloud Name`, `API Key`, and `API Secret`.

### 3. Deploy to Render
1. Push this project repository to GitHub.
2. Sign in to [Render](https://render.com/) and create a new **Web Service**.
3. Connect your GitHub repository.
4. Configure the service:
   - **Environment**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
5. Go to the **Environment** section and add all your environment variables exactly as they appear in the `.env` file.
6. Click **Create Web Service**. Render will build and deploy your app. Once finished, you will receive a public URL (e.g., `https://vaultshare.onrender.com`).

## Project Structure
- `server.js`: Application entry point.
- `models/`: Mongoose schemas (`File.js`, `User.js`).
- `controllers/`: Request handling logic (`authController.js`, `fileController.js`).
- `routes/`: Express API routers.
- `middleware/`: JWT verification middleware.
- `config/`: Cloudinary and Multer setup.
- `public/`: Frontend static files (HTML, CSS, JS).
