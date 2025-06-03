# MineSweeperCoop README

## Requisiti iniziali
Assicurati di aggiungere due file non inclusi per sicurezza:

- `.env` → contiene le chiavi VAPID:
- `serviceAccountKey.json` → le credenziali Firebase Admin SDK.

## Avvio del progetto
Avvio del server:  
  cd MineSweeperServer  
  npm install  
  node index.js

Avvio del client
  cd MineSweeperClient
  npm install
  npm run build
  npm run preview

### Firestore
Il progetto utilizza **Firebase Firestore**. Di seguito le regole che ho utilizzato

rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    //solo loggati
    match /leaderboard/{docId} {
      allow read: if request.auth != null;
      allow write: if false;
    }

    //solo il proprietario del documento
    match /utenti/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    
      match /replay/{replayId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
    
    //per le coop
    match /coopRun/{room} {
      allow write, read:  if room == request.auth.uid || resource.data.guestID == request.auth.uid;
      allow create: if room == request.auth.uid;
    }

    //per sicurezza tutto il resto
    match /{document=**} {
      allow read, write: if false;
    }
  }
}

