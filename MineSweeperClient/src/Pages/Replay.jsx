import { Link, useLocation } from "react-router-dom";
import  React, { useState, useEffect, useRef } from "react";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../firebase";
import GameGrid from '../Components/GameGrid';
import { Icon } from '@iconify/react';
import "../App.css";

function Replay() {
    const location = useLocation();
    const data = location.state?.data || {};
    const seed = useRef(data.seed || null);
    const [minesLeft, setMinesLeft] = useState(data.mines || 15);
    const [isPlaying, setIsPlaying] = useState(false); //inizia al primo click, termina con una vittoria/sconfitta
    const [resetSignal, setResetSignal] = useState(false); //per resettare la partita
    const [showEndDialog, setShowEndDialog] = useState(false);
    const [gameResult, setGameResult] = useState(""); // "win" o "lose"
    const [user, setUser] = useState(null); //se l'utente è loggato
    const [moveIndex, setMoveIndex] = useState(0);
    const LeftClick = useRef(null);
    const RightClick = useRef(null);
    const goBack = useRef(null);
    const [saveFile, _] = useState(data)

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

    //legge la prossima mossa
    const NextMove = () =>{
        if(saveFile.moves.length <= moveIndex)
            return;
        const move = saveFile.moves[moveIndex];
        setMoveIndex(m => m+1);

        if(move.action === "left")
            LeftClick.current(move.row, move.col, true);
        else if(move.action === "right")
            RightClick.current(move.row, move.col, true);
    }

    //pulsante resetta
    const Reset = () =>{
        if(moveIndex === 0)
            return;
        setMoveIndex(0);
        setResetSignal(x => !x);
    }

    const LastMove = async () =>{
        if(moveIndex === 0)
            return;
        const moveToGo = moveIndex-1;
        setMoveIndex(moveToGo);
        goBack.current(saveFile.moves, moveToGo);
    }

    return (
      <div>
        {/*topbar*/}
        <div className="topnav">
          <Link to="/Home" className="home">MineSweeperCoop</Link>
          <button className="arrow-button" onClick={Reset} style={{backgroundColor: moveIndex ===0? "#CCCCCC": "#63c74d" }}>
            <Icon icon="heroicons-solid:chevron-double-left" width="25" height="25"/>
          </button>
          <button className="arrow-button" onClick={LastMove} style={{marginLeft: "12px", backgroundColor: moveIndex ===0? "#CCCCCC": "#63c74d" }}>
            <Icon icon="heroicons-solid:chevron-left" width="25" height="25"/>
          </button>
          <h2> Final time: {saveFile.time}s</h2>
          <h2> Result: {saveFile.result}</h2>
          <button className="arrow-button" onClick={NextMove} style={{backgroundColor: saveFile.moves.length <= moveIndex? "#CCCCCC": "#63c74d" }}>
            <Icon icon="heroicons-solid:chevron-right" width="25" height="25"/>
          </button>
          {user? <div className="user"><h3>user: {user.displayName}</h3></div> : null}
        </div>

        <br/><br/><br/><br/><br/>
        <GameGrid 
          seed ={saveFile.seed} 
          start ={null} //se c'è il seed
          rows={saveFile.rows}
          cols={saveFile.cols}
          mines={saveFile.mines} 
          setMines={setMinesLeft} 
          isPlaying={setIsPlaying} 
          resetSignal={resetSignal} 
          setShowEndDialog={setShowEndDialog}
          setGameResult={setGameResult}
          onMove={null}
          isReplay={true}
          LeftClick={LeftClick}
          RightClick={RightClick}
          goBack={goBack}
          />
      </div>
    )
}

export default Replay;