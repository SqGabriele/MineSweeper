import express from "express";
import cors from "cors";
import webPush from "web-push";
import dotenv from "dotenv";
import admin from "firebase-admin";
import { readFileSync } from "fs";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

//credenziali da admin di firebase
const serviceAccount = JSON.parse(
  readFileSync("./serviceAccountKey.json", "utf-8")
);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

//se non ci sono le vapid
if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
  console.error("VAPID Key not found");
  process.exit();
}

webPush.setVapidDetails(
  "https://minesweepercoop.com",
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

//endpoint per ottenere la chiave pubblica
app.get("/vapidPublicKey", (req, res) => {
  res.send(process.env.VAPID_PUBLIC_KEY);
});

//registra una nuova subscription
app.post("/register", async (req, res) => {
    const { uid, subscription } = req.body;

    if (uid && subscription) {
        await db.collection("utenti").doc(uid).set({ token: JSON.stringify(subscription) }, { merge: true });
        res.sendStatus(201);
    } else {
        res.status(400).send("Missing data");
    }
});

//invita un utente a giocare
app.post("/send-invite", async (req, res) => {
    const { friendUsername, fromUsername, uid } = req.body;

    try {
        if(friendUsername === fromUsername) return res.status(404).send("User not found");

        const utentiRef = db.collection("utenti");
        const q = await utentiRef.where("username", "==", friendUsername).get();
        const hostID = uid;

        if (q.empty) return res.status(404).send("User not found");

        const userDoc = q.docs[0].data();
        const userDocRef = q.docs[0].ref;
        const subscription = userDoc.token;
        const doc = await userDocRef.get();
        const data = doc.data();
        const requests = data.requests || [];

        //inserisci l'invito nella casella
        requests.push({ from: fromUsername, lobby: hostID });
        await userDocRef.update({ requests });

        if(subscription!==undefined){
            await webPush.sendNotification(
            { endpoint: "", keys: { auth: "", p256dh: "" }, ...JSON.parse(subscription) },
            JSON.stringify({
                title: "Game Invite ",
                body: `${fromUsername} invited you to play!`,
            })
            );
        }
        res.send("Notification sent");

        //inserisci l'uid nella lobby (per i permessi)
        const coopRunRef = db.collection("coopRun");
        const lobbyRef = coopRunRef.doc(hostID);
        await lobbyRef.update({ guestID: userDoc.uid });

    } catch (error) {
        console.error("Push error:", error);
        res.status(500).send("Error sending push notification");
    }
});

//rifiuta il gioco
app.post("/send-decline-notification", async (req, res) => {
    const { toUsername, fromUsername } = req.body;

    try {
        const utentiRef = db.collection("utenti");
        const q = await utentiRef.where("username", "==", toUsername).get();

        if (q.empty) return res.status(404).send("User not found");

        const userDoc = q.docs[0].data();
        const subscription = userDoc.token;

        await webPush.sendNotification(
        { endpoint: "", keys: { auth: "", p256dh: "" }, ...JSON.parse(subscription) },
        JSON.stringify({
            title: "Invite Declined",
            body: `${fromUsername} declined your game invite.`,
        })
        );

        res.send("Decline notification sent");

        //rimuovi l'uid nella lobby (per i permessi)
        const coopRunRef = db.collection("coopRun");
        const lobbyRef = coopRunRef.doc(userDoc.uid);
        await lobbyRef.update({ guest: "", guestID: "", state:"none" });
    } catch (error) {
        console.error("Push error:", error);
        res.status(500).send("Error sending decline notification");
    }
});

//ccatta il gioco
app.post("/send-accept-notification", async (req, res) => {
    const { toUsername, fromUsername } = req.body;

    try {
        const utentiRef = db.collection("utenti");
        const q = await utentiRef.where("username", "==", toUsername).get();

        if (q.empty) return res.status(404).send("User not found");

        const userDoc = q.docs[0].data();
        const subscription = userDoc.token;

        await webPush.sendNotification(
        { endpoint: "", keys: { auth: "", p256dh: "" }, ...JSON.parse(subscription) },
        JSON.stringify({
            title: "Invite Accepted",
            body: `${fromUsername} accepted your game invite.`,
        })
        );

        res.send("Accept notification sent");
    } catch (error) {
        console.error("Push error:", error);
        res.status(500).send("Error sending decline notification");
    }
});

//cancella invito
app.delete("/delete-invitations", async (req, res) => {
    const { toUsername, fromUsername } = req.body;

    try {
        const utentiRef = db.collection("utenti");
        const q = await utentiRef.where("username", "==", toUsername).get();

        if (q.empty) return res.status(404).send("User not found");

        const userDocRef = q.docs[0].ref;
        const doc = await userDocRef.get();
        const data = doc.data();

        //rimuovi l'invito dalla casella
        const index = (data.requests || []).findIndex(
            r => r.from === fromUsername
        );
        data.requests.splice(index, 1)
        await userDocRef.update({ requests: data.requests });
        return res.status(200).send("Invitation removed");
    } catch (error) {
        console.error("Invite error:", error);
        res.status(500).send("Error removing invite");
    }
});

//inserisci un nome in leaderboard
app.post("/leaderboard", async (req, res) => {
  const { uid, name, time, gridSize } = req.body;

  if (!uid || !name || !time || !gridSize) {
    return res.status(400).send("Missing fields");
  }

  try {
    const leaderboardRef = db.collection("leaderboard").doc(gridSize);
    const leaderboardDoc = await leaderboardRef.get();

    if (!leaderboardDoc.exists) {
      return res.status(404).send("Leaderboard grid size not found");
    }

    let scores = leaderboardDoc.data().scores || [];
    scores.sort((a, b) => a.time - b.time);

    const isTop10 = scores.length < 10 || time < scores[scores.length - 1].time;
    if (isTop10) {
      if (scores.length >= 10) scores.pop();
      scores.push({
        uid,
        name,
        time,
        timestamp: new Date()
      });
      scores.sort((a, b) => a.time - b.time);
      await leaderboardRef.update({ scores });
    }
    return res.status(200).send("Leaderboard and stats updated");
  } catch (err) {
    console.error("Server error:", err);
    return res.status(500).send("Server error");
  }
});

//controlla che lo username esista già
app.post("/check-username", async (req, res) => {
  const { username } = req.body;

  if (!username || typeof username !== "string") {
    return res.status(400).json({ message: "Invalid username" });
  }

  try {
    const querySnapshot = await db
      .collection("utenti")
      .where("username", "==", username)
      .get();

    if (!querySnapshot.empty) {
      return res.status(409).json({ message: "Username already in use" });
    }

    return res.status(200).json({ message: "Username available" });
  } catch (err) {
    console.error("Error checking username:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

//porta 2708
app.listen(2708, () => {
  console.log("port 2708");
});
