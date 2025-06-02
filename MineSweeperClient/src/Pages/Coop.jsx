import { Link, useLocation } from "react-router-dom";
import  React, { useState, useEffect, useRef } from "react";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase";
import { useNavigate } from "react-router-dom";
import OnlineGameGrid from '../Components/OnlineGameGrid';
import resetImage from '../assets/reset.png';
import "../App.css"

function Coop() {
    const location = useLocation();
    const data = location.state?.data || {};
    const [seconds, setSeconds] = useState(0);
    const [minesLeft, setMinesLeft] = useState(75);
    const [isPlaying, setIsPlaying] = useState(false); //inizia al primo click, termina con una vittoria/sconfitta
    const [resetSignal, setResetSignal] = useState(false); //per resettare la partita
    const [showEndDialog, setShowEndDialog] = useState(false);
    const [gameResult, setGameResult] = useState(""); // "win" o "lose"
    const [moves, setMoves] = useState([]); //mosse salvate
    const [user, setUser] = useState(null); //se l'utente è loggato
    const [homeDialog, setHomeDialog] = useState(false);
    const navigate = useNavigate();

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
        if (user) {
          setUser(user);
        } else {
          setUser(null);
        }
      });
      return () => unsubscribe();
    }, []);

    const resetGame = () => {
      setMoves([]);
      setGameResult("");
      setSeconds(0); //resetta il timer
      setMinesLeft(75); //resetta il numero di mine
      setIsPlaying(false); //ferma il gioco
      setResetSignal(x => !x);
    };

    const closeLobby = async () =>{
      try {
        if (!user || !data.lobby) return;

        const lobbyRef = doc(db, "coopRun", data.lobby);
        await setDoc(lobbyRef, { state: "none", guest: "", host:user.displayName });
      } catch (error) {
        console.error("Failed to close lobby:", error);
      }
    }

    return (
      <div>
        {/*topbar*/}
        <div className="topnav">
          <button className="home" onClick={() => setHomeDialog(true)}>
            MineSweeperCoop
          </button>
          <h2> Time: {seconds}s</h2>
          <h2>  Mine: {minesLeft}</h2>
          {user?.uid === data.lobby && <button className="reset-button" onClick={resetGame}>
            <img src={resetImage}  alt="sR" style={{ width: '24px', height: '24px' }} />
          </button>}
          {user? <div className="user"><h3>user: {user.displayName}</h3></div> : null}
        </div>

        <br/><br/><br/><br/><br/>
        <OnlineGameGrid 
          rows={20}
          cols={20}
          mines={75} 
          setMines={setMinesLeft} 
          isPlaying={setIsPlaying} 
          resetSignal={resetSignal} 
          setShowEndDialog={setShowEndDialog}
          setGameResult={setGameResult}
          onMove={(row, col, action) => { setMoves(m => [...m, { row, col, action }]);}}
          uid = {user?.uid}
          lobby = {data.lobby}
          setSeconds={setSeconds}
          quit ={() => navigate("/Home")}
          />
        {/*dialog di vittoria o sconfitta  o alternativa per il guest*/}
        {showEndDialog && (
          user?.uid === data.lobby ?
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
                  <button onClick={() => closeLobby()}>Main menu</button>
                </Link>
              </div>
            </div>
          </div>:
          <div className="modal-overlay">
            <div className="modal">
              <h2>{gameResult === "win" ? ">> You won! <<" : ">> Game Over! <<"}</h2>
              <p>Time: <strong>{seconds}s</strong></p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '20px' }}>
                <p style={{fontSize:"19px"}}>Wait for the host to reset</p>

                <Link to="/Home">
                  <button>Main menu</button>
                </Link>
              </div>
            </div>
          </div>
        )}
      {/*dialog di conferma home */}
      {homeDialog && (
        <div className="dialog-overlay">
          <div className="dialog-box">
            <h2 className="dialog-title">Do you really want to exit?</h2>
            <hr style={{width:"100%"}}/><br/>
            <div className="confirm-buttons">
              <Link to="/Home" style={{ textDecoration: 'none' }}><button className="confirm-button-yes" onClick={() => closeLobby()}>Yes</button></Link>
              <button className="confirm-button-no" onClick={() => setHomeDialog(false)}>No</button>
            </div>
          </div>
        </div>
      )}
      </div>
    )
}

export default Coop;