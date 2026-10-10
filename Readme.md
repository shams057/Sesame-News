# 📰 Sesame News Application

Projet Certix / si kilani

---

## 📋 Table of Contents

- [Prerequisites](#-prerequisites)
- [Database Setup](#-database-setup)
- [Backend Setup](#-backend-setup)
- [Backoffice Setup (Admin)](#-backoffice-setup-admin)
- [Mobile App Setup (User)](#-mobile-app-setup-user)

---

## ⚙️ Prerequisites

Ensure you have the following installed before setting up the project:

- [Node.js](https://nodejs.org/) (v16 or higher)
- [XAMPP](https://www.apachefriends.org/) or [WampServer](https://www.wampserver.com/) (for phpMyAdmin & MySQL)
- [Android Studio](https://developer.android.com/studio) / Android SDK & ADB Tools
- [Expo CLI](https://docs.expo.dev/) (`npm install -g expo-cli`)
- An Android device with **USB Debugging** enabled

---

## 🗄️ Database Setup

1. Start Apache and MySQL in **XAMPP / WampServer**.
2. Open **phpMyAdmin** in your browser (`http://localhost/phpmyadmin`).
3. Create a new database named `sesame_news` (or your preferred name).
4. Click on the **Import** tab.
5. Choose the `sesame_news.sql` file provided in the repository and click **Go**.

---

## 🖥️ Backend Setup

1. Open your terminal and navigate to the backend directory:
   ```bash
   cd Backend
   ```
2. Install dependencies (if setting up for the first time):
   ```bash
   npm install
   ```
3. Start the Node server:
   ```bash
   node server.js
   ```

---

## 🛠️ Backoffice Setup (Admin)

Open a **new terminal window** and run:

1. Navigate to the admin directory:
   ```bash
   cd sesame-superadmin
   ```
2. Install dependencies (if setting up for the first time):
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```
4. Open your browser and go to:
   ```http
   http://localhost:5173
   ```

---

## 📱 Mobile App Setup (User)

Follow these steps to run the user application on a physical Android device:

### 1. Prepare your Android Device
- Go to **Settings > About Phone** on your device.
- Tap **Build Number** 7 times to enable **Developer Options**.
- Go to **Developer Options** and enable **USB Debugging**.
- Connect your phone to your computer using a USB cable and grant USB debugging permissions on your device screen.

### 2. Install ADB (Android Debug Bridge)
1. Download the [Android Platform Tools for Windows](https://dl.google.com/android/repository/platform-tools-latest-windows.zip).
2. Extract the downloaded `.zip` file.
3. Run `adb.exe` once or add the extracted folder to your system environment `PATH`.

### 3. Port Forwarding & Running the App
1. Open **Command Prompt (cmd) as Administrator**.
2. Navigate to your project's user directory:
   ```cmd
   cd path/to/project/sesame-user
   ```
3. Reverse the TCP port so the mobile device can connect to your local environment:
   ```cmd
   adb reverse tcp:3000 tcp:3000
   ```
4. Build and launch the app on your connected device:
   ```cmd
   npx expo run:android
   ```
   > ⚠️ **Note:** The initial build process may take **30 to 60 minutes** as it compiles native Android files. Subsequent runs will be significantly faster.

5. Once the build finishes, open the app on your phone.# 📰 Sesame News Application

Projet Certix / si kilani

---

## 📋 Table of Contents

- [Prerequisites](#-prerequisites)
- [Database Setup](#-database-setup)
- [Backend Setup](#-backend-setup)
- [Backoffice Setup (Admin)](#-backoffice-setup-admin)
- [Mobile App Setup (User)](#-mobile-app-setup-user)

---

## ⚙️ Prerequisites

Ensure you have the following installed before setting up the project:

- [Node.js](https://nodejs.org/) (v16 or higher)
- [XAMPP](https://www.apachefriends.org/) or [WampServer](https://www.wampserver.com/) (for phpMyAdmin & MySQL)
- [Android Studio](https://developer.android.com/studio) / Android SDK & ADB Tools
- [Expo CLI](https://docs.expo.dev/) (`npm install -g expo-cli`)
- An Android device with **USB Debugging** enabled

---

## 🗄️ Database Setup

1. Start Apache and MySQL in **XAMPP / WampServer**.
2. Open **phpMyAdmin** in your browser (`http://localhost/phpmyadmin`).
3. Create a new database named `sesame_news` (or your preferred name).
4. Click on the **Import** tab.
5. Choose the `sesame_news.sql` file provided in the repository and click **Go**.

---

## 🖥️ Backend Setup

1. Open your terminal and navigate to the backend directory:
   ```bash
   cd Backend
   ```
2. Install dependencies (if setting up for the first time):
   ```bash
   npm install
   ```
3. Start the Node server:
   ```bash
   node server.js
   ```

---

## 🛠️ Backoffice Setup (Admin)

Open a **new terminal window** and run:

1. Navigate to the admin directory:
   ```bash
   cd sesame-superadmin
   ```
2. Install dependencies (if setting up for the first time):
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```
4. Open your browser and go to:
   ```http
   http://localhost:5173
   ```

---

## 📱 Mobile App Setup (User)

Follow these steps to run the user application on a physical Android device:

### 1. Prepare your Android Device
- Go to **Settings > About Phone** on your device.
- Tap **Build Number** 7 times to enable **Developer Options**.
- Go to **Developer Options** and enable **USB Debugging**.
- Connect your phone to your computer using a USB cable and grant USB debugging permissions on your device screen.

### 2. Install ADB (Android Debug Bridge)
1. Download the [Android Platform Tools for Windows](https://dl.google.com/android/repository/platform-tools-latest-windows.zip).
2. Extract the downloaded `.zip` file.
3. Run `adb.exe` once or add the extracted folder to your system environment `PATH`.

### 3. Port Forwarding & Running the App
1. Open **Command Prompt (cmd) as Administrator**.
2. Navigate to your project's user directory:
   ```cmd
   cd path/to/project/sesame-user
   ```
3. Reverse the TCP port so the mobile device can connect to your local environment:
   ```cmd
   adb reverse tcp:3000 tcp:3000
   ```
4. Build and launch the app on your connected device:
   ```cmd
   npx expo run:android
   ```
   > ⚠️ **Note:** The initial build process may take **30 to 60 minutes** as it compiles native Android files. Subsequent runs will be significantly faster.

5. Once the build finishes, open the app on your phone.