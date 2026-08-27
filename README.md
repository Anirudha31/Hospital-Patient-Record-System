# Hospital-Patient-Record-System

A simple, modern, and responsive web-based Hospital Patient Record System built with HTML, CSS, JavaScript, and Firebase. It allows hospitals or clinics to securely manage patient data .

-> Setup Instructions -------------------------------------------------------------------------------------------------------------

1. Clone the repository 
   
   git clone https://github.com/Anirudha31/Hospital-Patient-Record-System.git

2️. Add your Firebase project config 

  Inside js/app.js, replace with your Firebase config:

    const firebaseConfig = {
      apiKey: "",
      authDomain: "",
      projectId: "",
      storageBucket: "",
      messagingSenderId: "",
      appId: ""
    };

3️. Enable Firebase Services 

 In Firebase Console:
 
 Authentication → Email/Password (Enable)
 
 Firestore Database (Create database)

4.  Change Firestore Security Rules 

  Follow these steps:

   Step 1: Open Firebase Console

  Go to:
  Firebase Console → Firestore Database → Rules Tab

   Step 2: Replace default rules with these:
  
    rules_version = '2';
    service cloud.firestore {
      match /databases/{database}/documents {
    
        // Allow logged-in users to access their own data
        match /users/{userId} {
          allow read, write: if request.auth != null && request.auth.uid == userId;
        }

        // Allow all authenticated users to use the patients collection
        match /patients/{docId} {
          allow read, write: if request.auth != null;
        }
      }
    }
  Step 3: Publish the Rules

 Click "Publish" to apply the changes.

5. Open the project 
   
 Just open any HTML file in your browser .
