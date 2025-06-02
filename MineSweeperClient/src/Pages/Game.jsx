import { Link, useLocation } from "react-router-dom";
import  React, { useState, useEffect, useRef } from "react";
import { collection, doc, getDoc, getDocs, updateDoc, query, orderBy, limit, addDoc, deleteDoc } from "firebase/firestore";
import { Icon } from '@iconify/react';
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../firebase";
import GameGrid from '../Components/GameGrid';
import resetImage from '../assets/reset.png';
import "../App.css"

function Game() {
    const location = useLocation();
    const data = location.state?.data || {};
    const seed = useRef(data.seed || null);
    const [seconds, setSeconds] = useState(0);
    const [minesLeft, setMinesLeft] = useState(data.mines || 15);
    const [isPlaying, setIsPlaying] = useState(false); //inizia al primo click, termina con una vittoria/sconfitta
    const [resetSignal, setResetSignal] = useState(false); //per resettare la partita
    const [showEndDialog, setShowEndDialog] = useState(false);
    const [showUploadDialog, setShowUploadDialog] = useState(false);
    const [gameResult, setGameResult] = useState(""); // "win" o "lose"
    const [moves, setMoves] = useState([]); //mosse salvate
    const [user, setUser] = useState(null); //se l'utente è loggato
    const [replayList, setReplayList] = useState([]);
    const [loadingReplay, setLoadingReplay] = useState(false);
    const [replayName, setReplayName] = useState("");
    const [replayToDelete, setReplayToDelete] = useState(null);
    const [saveError, setSaveError] = useState("");
    const [homeDialog, setHomeDialog] = useState(false);


    useEffect(() => {
      //imposta il timer
      if(!isPlaying) return;
      const interval = setInterval(() => {
        setSeconds(s => s < 9999 ? s + 1 : s);
      }, 1000);
      //cleanup
      return () => clearInterval(interval);
    }, [isPlaying]);

    //monitora lo stato del login
    useEffect(() => {
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        if (user && navigator.onLine) {
          setUser(user);
        } else {
          setUser(null);
        }
      });
      return () => unsubscribe();
    }, []);

    //scarica la lista di replay
    useEffect(() => {
      const fetchReplays = async () => {
        if (!user || !showUploadDialog) return;
        setLoadingReplay(true);
        try {
          const replayRef = collection(db, "utenti", user.uid, "replay");
          const q = query(replayRef, orderBy("timestamp", "desc"), limit(5));
          const querySnapshot = await getDocs(q);
          const replays = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setReplayList(replays);
        } catch (error) {
          console.error("Replay download failed:", error);
        } finally {
          setLoadingReplay(false);
        }
      };
      fetchReplays();
    }, [showUploadDialog, user]);

    const resetGame = () => {
      setMoves([]);
      setGameResult("");
      setSeconds(0); //resetta il timer
      setMinesLeft(data.mines || 15); //resetta il numero di mine
      setIsPlaying(false); //ferma il gioco
      setResetSignal(x => !x);
    };

    const saveOffline = () => {
      const json = {
        time: seconds,
        seed: seed.current,
        mines: data.mines || 15,
        rows: data.rows || 10,
        cols: data.cols || 10,
        result: gameResult,
        moves: moves
      };
    
      const blob = new Blob([JSON.stringify(json, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `minesweeper-${Date.now()}.json`;
      a.click();  //fa partire il download
      URL.revokeObjectURL(url);
    };

    //controllo di essere in leaderboard ed in caso salvo (anche per le statistiche)
    useEffect (() =>{
      const enterLeaderboard = async() =>{
        if(gameResult !== "win" || !user || data.seed)
          return;
        let gridSize = null;
        if(data.rows === 9 && data.cols === 9)
          gridSize = "small";
        else if(data.rows === 16 && data.cols === 16)
          gridSize = "medium";
        else if(data.rows === 20 && data.cols === 20)
          gridSize = "large";
        else 
          return;

        try {
          await fetch(`${import.meta.env.VITE_API_URL}/leaderboard`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              uid: user.uid,
              name: user.displayName,
              time: seconds,
              gridSize: gridSize
            })
          });
        } catch (err) {
          console.error("Errore invio al server:", err);
      }

        //aggiorno le statistiche
        const docRef2 = doc(db, "utenti", user.uid);
        const docSnap2 = await getDoc(docRef2);
        if (!docSnap2.exists()) {
          console.error("stats load error");
          return;
        }
        let stats = docSnap2.data() || {};
        stats.win++;
        if(stats.bestTime === "???" || seconds < stats.bestTime)
          stats.bestTime = seconds;
        
        await updateDoc(docRef2, stats);
      }
      enterLeaderboard();
    },[gameResult]);

    const saveGameOnline = async () => {
      if (!user) return;
      const replayRef = collection(db, "utenti", user.uid, "replay");
      const querySnapshot = await getDocs(query(replayRef, orderBy("timestamp")));

      //se ci sono già 5 replay, annullo
      if (querySnapshot.size >= 5) {
        setSaveError("You have reached the limit of 5");
        return;
      }

      const newReplay = 
      {
        timestamp: new Date(),
        name: replayName || "Game",
        time: seconds,
        seed: seed.current,
        mines: data.mines || 15,
        rows: data.rows || 10,
        cols: data.cols || 10,
        result: gameResult,
        moves: moves
      }

      const estimatedSize = new Blob([JSON.stringify(newReplay)]).size;
      if (estimatedSize > 1024 * 1024) {
        setSaveError("Replay is too large to save online.");
        return;
      }

      await addDoc(replayRef, newReplay);
      setShowUploadDialog(false);
      setShowEndDialog(true);
      setReplayName("");
      setSaveError("");
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

    return (
      <div>
        {/*topbar*/}
        <div className="topnav">
          <button className="home" onClick={() => setHomeDialog(true)}>
            MineSweeperCoop
          </button>
          <h2> Time: {seconds}s</h2>
          <h2>  Mine: {minesLeft}</h2>
          <button className="reset-button" onClick={resetGame}>
            <img src={resetImage}  alt="R" style={{ width: '24px', height: '24px' }} />
          </button>
          {user? <div className="user"><h3>user: {user.displayName}</h3></div> : null}
        </div>

        <br/><br/><br/><br/><br/>
        <GameGrid 
          seed ={seed} 
          start ={data? [data.row, data.column]: null} //se c'è il seed
          rows={data.rows || 9}
          cols={data.cols || 9}
          mines={data.mines || 15} 
          setMines={setMinesLeft} 
          isPlaying={setIsPlaying} 
          resetSignal={resetSignal} 
          setShowEndDialog={setShowEndDialog}
          setGameResult={setGameResult}
          onMove={(row, col, action) => { setMoves(m => [...m, { row, col, action }]);}}
          />
        {/*dialog di vittoria o sconfitta */}
        {showEndDialog && (
          <div className="modal-overlay">
            <div className="modal">
              <h2>{gameResult === "win" ? ">> You won! <<" : ">> Game Over! <<"}</h2>
              <p>Time: <strong>{seconds}s</strong></p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '20px' }}>
                <button onClick={() => {
                  setShowEndDialog(false);
                  resetGame();
                }}>Play again</button>

                <Link to="/Home">
                  <button>Main menu</button>
                </Link>

                <button onClick={() => {setShowUploadDialog(true); setShowEndDialog(false)}} disabled={!user} style={{backgroundColor: user ? "#63c74d" : "#ccc", color: user ? "white" : "#666", cursor: user ? "pointer" : "not-allowed"}}>
                  Save Game</button>
                <button onClick={() =>  saveOffline()}>Download Game</button>
              </div>
            </div>
          </div>
        )}
        {/*dialog di upload salvataggi */}
        {showUploadDialog && (
        <div className="dialog-overlay-save">
          <div className="dialog-box" style={{width:"30%"}}>
            <h2 className="dialog-title" style={{fontSize:"3vh"}}>Saved Replays</h2>
            <hr className="dialog-divider" />

            {loadingReplay ? (
              <p>Loading...</p>
            ) : replayList.length === 0 ? (
              <p>No saved replays yet.</p>
            ) : (
              <ul className="dialog-replay-list">
                {replayList.map((r, i) => (
                  <li key={r.id} className="replay-slot" style={{fontSize:"1.5vh"}}>
                    <button
                      onClick={() => setReplayToDelete(r.id)}
                      title="Delete replay"
                      className="dialog-delete-button"
                    >
                      <Icon icon="heroicons:trash" width="25" height="25" color="#d11a2a"/>
                    </button>
                    <span>
                      #{i + 1} {r.name || "Untitled"} – {r.time}s
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <p className="dialog-replay-count" style={{fontSize:"2vh"}}>
              {replayList.length}/5 replay slots used
            </p>

            {saveError && (
              <p style={{ color: "red", fontSize: "1.7vh", marginTop: "10px" }}>
                {saveError}
              </p>
            )}
            <input
              type="text"
              value={replayName}
              onChange={(e) => setReplayName(e.target.value)}
              placeholder="Enter a name for the replay"
              className="dialog-input"
            />

            <div className="dialog-footer">
              <button
                onClick={saveGameOnline}
                className="confirm-button-yes-save"
              >
                Save Replay
              </button>
              <button
                onClick={() => {
                  setShowEndDialog(true);
                  setShowUploadDialog(false);
                }}
                className="confirm-button-no-save"
                style={{backgroundColor:"red"}}
              >
                Close
              </button>
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
      ) }
      {/*dialog di conferma home */}
      {homeDialog && (
        <div className="dialog-overlay">
          <div className="dialog-box">
            <h2 className="dialog-title">Do you really want to exit?</h2>
            <hr style={{width:"100%"}}/><br/>
            <div className="confirm-buttons">
              <Link to="/Home" className="confirm-button-yes" style={{ textDecoration: 'none' }}>Yes</Link>
              <button className="confirm-button-no" onClick={() => setHomeDialog(false)}>No</button>
            </div>
          </div>
        </div>
      )}
      </div>
    )
}

export default Game;