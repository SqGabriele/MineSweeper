import { Link, useLocation } from "react-router-dom";
import  React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged,signOut } from "firebase/auth";
import { auth,db } from "../firebase";
import { doc, getDoc, collection, query, orderBy, limit, getDocs, deleteDoc, onSnapshot, updateDoc, setDoc } from "firebase/firestore";
import SinglePlayer from '../assets/PlaySingle.png';
import Coop from '../assets/Coop.png';
import Challenge from '../assets/Challenge.png';
import Mail from '../assets/mail.png';
import { Icon } from '@iconify/react';
import "../App.css"

function Home() {
  const location = useLocation();
  const data = location.state?.data || {};
  const navigate = useNavigate();
  const [user, setUser] = useState(null); //se l'utente è loggato
  const [selectGameMode, setSelectGameMode] = useState(false); //apre il dialog per la selezione della griglia
  const [leaderboard, setLeaderboard] = useState({small: [],medium: [],large: []});
  const [stats, setStats] = useState({user:"???", win:"???",bestTime:"???" });
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const challenge = useRef(null);
  const fileInputRef = useRef(null);
  const [replayList, setReplayList] = useState([]);
  const [replayToDelete, setReplayToDelete] = useState(null);
  const [inviteAFriend, setInviteAFriend] = useState(false);
  const [inviteSent, setInviteSent] = useState(false); //dialog di attesa
  const [friendUsername, setFriendUsername] = useState("");
  const [inviteError, setInviteError] = useState("");
  const [mailDialog, setMailDialog] = useState(false);
  const [invitation, setInvitation] = useState([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user || !(navigator.onLine))
        navigate("/"); //torna al login se non autenticato
    });
    
    return () => unsubscribe();
  }, [navigate]);

  //monitora lo stato del log
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUser(user);
      } else {
        setUser(null);
      }
    });
    return () => unsubscribe();
  }, []);

  //scarica la leaderboard ed i dati utente
  useEffect(() => {
    const fetchLeaderboard = async () => {
      if(!user)
        return;
      const sizes = ["small", "medium", "large"];
      const newData = {};

      for (const size of sizes) {
        try {
          const docRef = doc(db, "leaderboard", size);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const scores = docSnap.data().scores || [];
            //ordina per tempo crescente
            newData[size] = scores.sort((a, b) => a.time - b.time);
          } else {
            newData[size] = [];
          }
        } catch (error) {
          console.error("leaderboard download error", error);
          newData[size] = [];
        }
      }

      setLeaderboard(newData);
    };
    const fetchUserData = async () => {
      const newData = {user:"???", win:"???",bestTime:"???" };
      try {
        const docRef = doc(db, "utenti", user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          newData.user = docSnap.data().username ?? user.displayName ?? "???";
          newData.win = docSnap.data().win ?? 0;
          newData.bestTime = docSnap.data().bestTime ?? "???";
        }
      } catch (error) {
        console.error("stats download error", error);
      }

      setStats(newData);
    };
    fetchLeaderboard();
    if (user)
      fetchUserData();
  }, [user, user?.displayName]);

  //aggiorna le notification quando ne arriva una nuova
  useEffect(() => {
    if (!user) return;

    const userDocRef = doc(db, "utenti", user.uid);

    //attiva il listener in tempo reale
    const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setInvitation(data.requests || []);
      }
    });

    //pulizia
    return () => unsubscribe();
  }, [user]);

  //scarica la lista di replay e degli inviti
  useEffect(() => {
    const fetchReplays = async () => {
      if (!user) return;
      try {
        //replay
        const replayRef = collection(db, "utenti", user.uid, "replay");
        const q = query(replayRef, orderBy("timestamp", "desc"), limit(5));
        const querySnapshot = await getDocs(q);
        const replays = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setReplayList(replays);

        //inviti
        const userDocRef = doc(db, "utenti", user.uid);
        const userSnap = await getDoc(userDocRef);

        if (userSnap.exists()) {
          const data = userSnap.data();
          const requests = data.requests || [];

          const validatedRequests = [];

          for (const req of requests) {
            try {
              if (!req.lobby) continue;
              const lobbyRef = doc(db, "coopRun", req.lobby);
              const lobbySnap = await getDoc(lobbyRef);

              if (lobbySnap.exists()) 
                validatedRequests.push(req);
            } catch (err) {
              continue;
            }
          }

        //dopo aver filtrato aggiorno
        if (JSON.stringify(validatedRequests) !== JSON.stringify(requests)) {
          await updateDoc(userDocRef, { requests: validatedRequests });
        }

        setInvitation(validatedRequests);
      }
      } catch (error) {
        console.error("Replay download failed:", error);
      }}
    fetchReplays();
  }, [user]);

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file && file.type === "application/json") {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          navigate("/Replay", { state: { data } });
        } catch (error) {
          console.error("Errore parsing JSON:", error);
          alert("Invalid JSON file.");
        }
      };
      reader.readAsText(file);
    } else {
      alert("Please upload a valid JSON file.");
    }
  };

  //se arriva una notifica di rifiuto a giocare esco dal dialog
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.addEventListener("message", event => {
      const data = event.data;
      if (data && data.title === "Invite Declined") {
        if (window.location.pathname === "/Home") {
          setInviteSent(false);
        }
      }
    });
  }, []); 

  //riproduci il replay della partita
  const savedReplay = (game) =>{
    const data = game;
    navigate("/Replay", { state: { data } });
  }


  //calcola la daily challenge
  function DailyChallenge() {
    if(challenge.current)
      return challenge.current

    const today = new Date();
    const utcDate = today.toISOString().slice(0, 10); //dat di oggi

    //hash della data
    let hash = 0;
    for (let i = 0; i < utcDate.length; i++) {
      hash = (hash << 5) - hash + utcDate.charCodeAt(i); //mescola caratteri
      hash |= 0; //rimane int
    }
    const absHash = Math.abs(hash);

    const res = {
      seed: absHash,
      row: absHash % 16,
      column: (Math.floor(absHash / 100)) % 16,
    };
    challenge.current = res;
    return res;
  }

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate("/"); // Torna alla pagina di login
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  const deleteReplay = async (replayId) => {
    if (!user || !replayId) return;
    try {
      await deleteDoc(doc(db, "utenti", user.uid, "replay", replayId));
      setReplayList(prev => prev.filter(r => r.id !== replayId));
    } catch (error) {
      console.error("Failed to delete replay:", error);
    }
  };

  const sendInvite = async () => {
    //crea la lobby
    try {
      const lobbyRef = doc(db, "coopRun", user.uid);

      await setDoc(lobbyRef, {
        host: user.displayName,
        guest: friendUsername,
        state: "pending",
      });

      //aspetta che venga accettato
      const unsub = onSnapshot(lobbyRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.state === "waiting") {
            navigate("/Coop", { state: { data: { lobby: user.uid } } });
            unsub(); //disiscriviti
          }
        }
      });

    } catch (error) {
      console.error("Error during invitation:", error);
      setInviteError("Error during invitation.");
    }

    //chiedi al server di invitare
    const res = await fetch(`${import.meta.env.VITE_API_URL}/send-invite`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        friendUsername,
        fromUsername: auth.currentUser.displayName,
        uid: user.uid
      })
    });

    if (res.ok) {
      setInviteSent(true);
      setInviteAFriend(false);
      setInviteError("");
    } else if (res.status === 404) {
      setInviteError("Error: User not found")
      return;
    } else {
      setInviteError("Error: Invite failed");
      return;
    }
  }

  const handleResponse = async (invite, response = "decline") =>{
    try {
      const userDocRef = doc(db, "utenti", user.uid);
      const userSnap = await getDoc(userDocRef);

      if (!userSnap.exists()) {
        console.error("User doc not found");
        return;
      }

      let data = userSnap.data();
      const index = (data.requests || []).findIndex(
        r => r.from === invite.from
      );
      data.requests.splice(index, 1)
      
      await updateDoc(userDocRef, {  requests: data.requests });

      //notifica il mittente che la richiesta è stata rifiutata/accettata
      await fetch(`${import.meta.env.VITE_API_URL}/send-`+response+`-notification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toUsername: invite.from,
          fromUsername:  auth.currentUser.displayName,
        }),
      });
    } catch (err) {
      console.error(err);
      return;
    }
    //inizio la lobby
    const userDocRef = doc(db, "coopRun", invite.lobby);
    await updateDoc(userDocRef, {  state: "waiting" });

    if(response==="accept")
      navigate("/Coop", { state: { data: { lobby: invite.lobby } } });
  }

  const cancelInvitation = async () =>{
    setInviteSent(false);
    await fetch(`${import.meta.env.VITE_API_URL}/delete-invitations`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        toUsername: friendUsername,
        fromUsername: auth.currentUser.displayName
      })
    });

    //modifica la lobby cancellando l'invito
    try {
      const lobbyRef = doc(db, "coopRun", user.uid);
      await setDoc(lobbyRef, {
        host: user.displayName,
        guest: "",
        state: "none",
      });
    } catch (error) {
      console.error("Error during invitation:", error);
      setInviteError("Error during invitation.");
    }
  }

  return (
    <div className="home-container">
      <div className="topnav">
        <Link to="/Home" className="home">MineSweeperCoop</Link>
        {user ? (
          <>
            <button onClick={() => setLogoutDialogOpen(true)} className="logout" title="Logout" >
              <Icon icon="heroicons-solid:arrow-left-on-rectangle" width="25" height="25"/>
            </button>

            <div className="user">
              <h3>user: {user.displayName}</h3>
            </div>
          </>
        ) : null}
      </div>

      <div className="sections-wrapper">
        {/*sezione 1 */}
          <div className="button-grid-main">
            <button className="pixel-button" onClick={() => setSelectGameMode(true)}>
              <img src={SinglePlayer} style={{ width: '300px', height: '300px' }} alt="singleplayer" />
              <span><b>SINGLEPLAYER</b></span>
            </button>
            <button className="pixel-button" onClick={() => setInviteAFriend(true)}>
              <img src={Coop} style={{ width: '300px', height: '300px' }} alt="invite" />
              <span><b>CO-OP</b></span>
            </button>
            <button className="pixel-button" onClick={() => 
              navigate("/Game", { state: { data: { rows:16, cols:16, mines:40, seed: DailyChallenge().seed, row: DailyChallenge().row, column: DailyChallenge().column } } })}>
              <img src={Challenge} style={{ width: '300px', height: '300px' }}  alt="daily challenge" />
              <span><b>CHALLENGE</b></span>
            </button>
            <button className="pixel-button" onClick={() => setMailDialog(true)}>
              <div className="mail-icon-wrapper">
                <img src={Mail} style={{ width: '300px', height: '300px' }} alt="inbox" />
                {invitation.length > 0 && (
                  <div className="badge">{invitation.length}</div>
                )}
              </div>
              <span><b>MAIL BOX</b></span>
            </button>
          </div>


        {/*sezione 2*/}
        <section className="home-section">
          <h2 className="leaderboard-title">LEADERBOARD</h2>

          {/* small Grid */}
          <div>
            <h3 className="grid-title">SMALL GRID</h3>
            <div className="card-row">
              {leaderboard.small.map((entry, i) => (
                <div key={i} className="card">
                  <p><strong>{entry.name}</strong></p>
                  <p>Time: {entry.time}</p>
                </div>
              ))}
            </div>
          </div>

          {/* medium Grid */}
          <div>
            <h3 className="grid-title">MEDIUM GRID</h3>
            <div className="card-row">
              {leaderboard.medium.map((entry, i) => (
                <div key={i} className="card">
                  <p><strong>{entry.name}</strong></p>
                  <p>Time: {entry.time}</p>
                </div>
              ))}
            </div>
          </div>

          {/* large Grid */}
          <div>
            <h3 className="grid-title">LARGE GRID</h3>
            <div className="card-row">
              {leaderboard.large.map((entry, i) => (
                <div key={i} className="card">
                  <p><strong>{entry.name}</strong></p>
                  <p>Time: {entry.time}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/*sezione 3*/}
        <section className="home-section">
          <h2 className="section-title">SAVED RUN</h2>
          <div className="saved-section">
            {/*lista partite*/}
            <div className="saved-games scrollable-row">
              <div className="save-card" onClick={() => fileInputRef.current.click()} style={{ cursor: "pointer",backgroundColor: "#007BFF",display: "flex",alignItems: "center",flexDirection: "column", }}>
                <p style={{fontWeight: "bold"}}>From Disk</p>
                <Icon icon="mdi:content-save" width="100" height="100" />
                <input
                  type="file"
                  accept=".json"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  style={{ display: "none" }}
                />
              </div>
              {replayList.map((n, index) => (
                <div key={index} className="save-card">
                  <p className="save-title">{n.name}</p>
                  <p className="save-detail">Size: {n.cols === 9? "SMALL" : n.cols===16? "MEDIUM" : "LARGE"}</p>
                  <p className="save-detail">Tempo: {n.time}</p>
                  <div className="saved-buttons">
                    <button onClick={() => savedReplay(n)} className="saved-btn replay" style={{backgroundColor:"cyan"}}>
                      <Icon icon="heroicons-solid:play" width="20"/>
                    </button>
                    <button onClick={() => setReplayToDelete(n.id)} className="saved-btn delete" style={{backgroundColor:"red"}}>
                      <Icon icon="heroicons-solid:trash" width="20" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/*statistiche*/}
            <div className="stats-box">
              <h3 className="stats-title">Stats</h3>
              <p><strong>Name:</strong> {stats.user}</p>
              <p><strong>Win:</strong> {stats.win}</p>
              <p><strong>Best Time:</strong> {stats.bestTime}</p>
            </div>
          </div>
        </section>
      </div>
      {/* dialog per la selezione della modalità*/}
      {selectGameMode && (
        <div className="dialog-overlay">
          <div className="dialog-box">
            <h2 className="dialog-title">Select Grid Size</h2>
            <button className="dialog-button" onClick={() => navigate("/Game", { state: { data: { rows:9, cols:9, mines:10 } } })}>Small</button>
            <button className="dialog-button" onClick={() => navigate("/Game", { state: { data: { rows:16, cols:16, mines:40 } } })}>Medium</button>
            <button className="dialog-button" onClick={() => navigate("/Game", { state: { data: { rows:20, cols:20, mines:75 } } })}>Large</button>
            <button className="dialog-button cancel" onClick={() => setSelectGameMode(false)}>Cancel</button>
          </div>
        </div>
      )}
      {/*dialog di conferma logout */}
      {logoutDialogOpen && (
        <div className="dialog-overlay">
          <div className="dialog-box">
            <h2 className="dialog-title">Do you really want to log out?</h2>
            <hr style={{width:"100%"}}/><br/>
            <div className="confirm-buttons">
              <button className="confirm-button-yes" onClick={handleLogout}>Yes</button>
              <button className="confirm-button-no" onClick={() => setLogoutDialogOpen(false)}>No</button>
            </div>
          </div>
        </div>
      )}
      {/*dialog conferma eliminazione*/}
      {replayToDelete && (
      <div className="modal-overlay">
        <div className="modal">
          <h3>Delete Replay?</h3>
          <p>This action cannot be undone.</p>

          <div style={{ marginTop: "15px", display: "flex", justifyContent: "center", gap: "10px" }}>
            <button 
              onClick={async () => {
                await deleteReplay(replayToDelete);
                setReplayToDelete(null);
              }} 
              style={{ backgroundColor: "#d11a2a", color: "white" }}
            >
              Yes, delete
            </button>
            <button onClick={() => setReplayToDelete(null)}>
              Cancel
            </button>
          </div>
        </div>
      </div>
      )}
      {/*dialog invitare un giocatore*/}
      {inviteAFriend && (
      <div className="dialog-overlay">
          <div className="dialog-box">
            <h2 className="dialog-title">Enter a friend's username</h2>
            <input
              type="text"
              placeholder="username"
              value={friendUsername}
              onChange={(e) => setFriendUsername(e.target.value)}
              required
              className="auth-input"
              style={{width:"95%"}}
            />
            <button onClick={sendInvite} className="confirm-button-yes" style={{fontSize: "14px", width: "100%"}}>
              Send Invite
            </button>
            <button onClick={() => {setInviteAFriend(false);setInviteError("")} } className="confirm-button-no" style={{fontSize: "14px", width: "100%"}}>
              Cancel
            </button>
            <p>{inviteError}</p>
          </div>
        </div>
      )}
      {/*dialog di attesa*/}
      {inviteSent && (
      <div className="dialog-overlay">
          <div className="dialog-box">
            <h2 className="dialog-title">Waiting for the invitation to be accepted</h2>
            <span className="dots" style={{color:"#feae34", fontSize:"20px"}}>.</span>
            <button onClick={() => cancelInvitation()} className="confirm-button-no" style={{fontSize: "14px", width: "100%"}}>
              Cancel
            </button>
          </div>
        </div>
      )}
      {/*dialog per gli inviti*/}
      {mailDialog && (
      <div className="dialog-overlay">
          <div className="dialog-box" >
            <h2 className="dialog-title">MAIL BOX</h2>

            {invitation.length > 0 ? (
              <ul className="invite-list">
                <div style={{width:"800px", maxHeight:"600px", overflow:"auto"}}>
                  {invitation.map((invito, index) => (
                    <li key={index} className="invite-item">
                      <span className="invite-text">
                        "{invito.from}" invited you to play
                      </span>
                      <div className="invite-actions">
                        <button className="accept-button" onClick={() => handleResponse(invito, "accept")}>
                          <Icon icon="heroicons-solid:play" width="20" />
                        </button>
                        <button className="decline-button" onClick={() => handleResponse(invito, "decline")}>
                          <Icon icon="heroicons-solid:trash" width="20" />
                        </button>
                      </div>
                    </li>
                  ))}
                </div>
              </ul>
            ) : (
              <p>You currently have no invitations.</p>
            )}

            <button onClick={() => {setMailDialog(false)} } className="confirm-button-no" style={{fontSize: "14px", width: "100%"}}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Home;
