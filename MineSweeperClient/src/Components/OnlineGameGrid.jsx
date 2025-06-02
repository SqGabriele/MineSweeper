import React, { useEffect, useState, useRef } from 'react';
import { auth  } from "../firebase";
import { onSnapshot, doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import seedrandom from 'seedrandom';
import flagImage from '../assets/flag.png';
import flagImage2 from '../assets/flag2.png';
import mineImage from '../assets/mine.png';
import "../App.css"

const OnlineGameGrid = ({ rows = 10, cols = 10, mines = 15, setMines, isPlaying, resetSignal, setShowEndDialog, setGameResult, onMove, uid, lobby, setSeconds, quit}) => {
  const [grid, setGrid] = useState([]);
  const initialized = useRef(false);
  const gameEnded = useRef(false);
  const tilesLeft = useRef(rows*cols - mines);
  const seed = useRef(null);
  const replayRef = useRef(doc(db, "coopRun", lobby));

  //conta le mine
  useEffect(() => {
    let count = 0;
    grid.forEach(row => {
      row.forEach(cell => {
        if (cell.flagged && !cell.revealed) count++;
      });
    });
    setMines(75 - count);
  }, [grid]);

  useEffect(() => {
    initialized.current = false;
    gameEnded.current = false;
    tilesLeft.current = rows*cols - mines;
    seed.current = Math.floor(Math.random() * 1e13);

    //prima griglia di placeholder
    const newGrid = Array(rows)
        .fill(null)
        .map((_, row) =>
        Array(cols)
            .fill(null)
            .map((_, col) => {
            const index = row +"-"+ col;
            return {
                row,
                col,
                hasMine: false,
                revealed: false,
                flagged: false,
                adiacent : 0,
              }
            })
        )
    
    setGrid(newGrid);
    updateRun(newGrid);
  }, [resetSignal])

  //aggiorna lo stato della matrice
  useEffect(() => {
    if(!uid)
      return;
    let unsub;
    try {
    unsub = onSnapshot(
      replayRef.current,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.senderId === uid) return;

          if ("matrix" in data) {
            const matrix = JSON.parse(data.matrix);
            setGrid(matrix);
          }

          initialized.current = data.state !== "waiting";

          if (data.state === "lose") endGame(0);
          else if (data.state === "win") endGame(1);
          else if (data.state === "waiting") {
              setShowEndDialog(false);
              setGameResult("");
              setSeconds(0);
              isPlaying(false);
          } else if (data.state === "going") {
              isPlaying(true);
          } else if (data.state === "none") {
              quit();
          }
        }
      },
      (error) => {
        if (error.code === "permission-denied") {
          quit();
        } else {
          console.error("Snapshot error:", error);
        }
      }
    );
    } catch (err) {
      console.error("Snapshot setup error:", err);
    }

    return () => unsub();
  }, [uid]);

  const updateRun = async (matrix) =>{
    if (!uid) return;

    let currentState = "waiting";
    if(initialized.current)
      currentState = "going";
    if(gameEnded.current)
      currentState = gameEnded.current;

    await updateDoc(replayRef.current, {
      matrix: JSON.stringify(matrix),
      senderId: uid,
      state: currentState,
    });
  }

  const generateGrid = (startRow, startCol, mygrid=null) => {
    const rng = seedrandom(seed);
    const mineIndexes = new Set();

    while (mineIndexes.size < mines) {
        const a = Math.floor(rng() * rows);
        const b = Math.floor(rng() * cols);
        if (Math.abs(a - startRow) <= 1 && Math.abs(b - startCol) <= 1) continue; //così non generi bombe al primo click
        mineIndexes.add(a+"-"+b);
    }
    
    //funzione di supporto
    const countAdiacent = (row, col) =>{
      let count = 0;
      for(let a = row-1; a<=row+1; a++){
        for(let b = col-1; b<=col+1; b++){
          if (
            a >= 0 && a < rows &&
            b >= 0 && b < cols &&
            !(a === row && b === col)
          ) {
            if (mineIndexes.has(`${a}-${b}`)) count++;
          }
        } 
      }
      return count;
    }
    
    //crea griglia
    const g = mygrid!==null? mygrid: grid;
    return Array(rows).fill(null).map((_, row) =>
      Array(cols).fill(null).map((_, col) => {
        const index = `${row}-${col}`;
        return {
          row,
          col,
          hasMine: mineIndexes.has(index),
          revealed: (row==startRow && col==startCol)? "green": false,
          flagged: g[row][col].flagged,
          adiacent: countAdiacent(row, col),
        };
      })
    );
  };

  const showMines = () => {
    setGrid(prev => 
      prev.map(row =>
        row.map(cell => {
          if (cell.hasMine) {
            return { ...cell, revealed: true };
          }
          return cell;
        })
      )
    );
  };

  //modifica la griglia senza effettuare il re-render
  const revealGrid = (grid, row, col, force = false) => {
    const cell = grid[row][col];
  
      if (cell.revealed===true && !force) return grid;
      if (cell.hasMine) return grid;

        if (cell.revealed !== true) {
          if (cell.flagged) {
            cell.flagged = false;
          }
          cell.revealed = true;
          tilesLeft.current--;
        }
      if (cell.adiacent > 0) return grid;
    
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const newRow = row + dr;
          const newCol = col + dc;
    
          if (
            newRow >= 0 && newRow < rows &&
            newCol >= 0 && newCol < cols &&
            grid[newRow][newCol].revealed !==true
          ) {
            grid = revealGrid(grid, newRow, newCol);
          }
        }
      }
  
    return grid;
  };

  //vittoria o sconfitta
  const endGame = (win) =>{
    isPlaying(false);

    if(!win)
      showMines();

    setShowEndDialog(true);
    setGameResult(win ? "win" : "lose");
  }

  const handleCellClick = (row, col, force=false, gridNow = grid) => {
    if(gameEnded.current) return;
    if(!force && (gridNow[row][col].revealed==true || gridNow[row][col].flagged))
      return;

    //genera la griglia al primo click
    if (!initialized.current) {
      const newGrid = generateGrid(row, col);
      setGrid(newGrid);
      initialized.current = true;
      isPlaying(true);
      setTimeout(() => handleCellClick(row, col, force, newGrid), 0);
      return;
    }

    if (onMove && !force) onMove(row, col, "left"); //salva la mossa

    //aggiorna la griglia rirenderizzando
    let updated = gridNow.map(r => r.map(c => ({ ...c })));
    updated[row][col].revealed = true;
    tilesLeft.current--;

    if(updated[row][col].hasMine === false){
      updated = revealGrid(updated, row, col, true);
      if (tilesLeft.current === 0){
        gameEnded.current = "win";
        setTimeout(() => endGame(true), 0); // hai vinto
      }
    }     
    else{
      gameEnded.current = "lose";
      setTimeout(() => {endGame(false);},0); //hai perso
    }

    setGrid(updated);
    updateRun(updated);
  }

  

  const handleRightClick = (row, col, force=false) => {
    if(gameEnded.current) return;

    if (onMove) onMove(row, col, "right");
  
    const updated = grid.map(r => r.map(c => ({ ...c })));
    const cell = updated[row][col];

    if (cell.revealed !== true) 
      cell.flagged = cell.flagged? false : uid;
  
    setGrid(updated);
    updateRun(updated);
  };

  //colora i numeri in base alla gravità
  const getCellColor = (num) => {
    switch (num) {
      case 1: return 'green';
      case 2: return 'blue';
      case 3: return 'red';
      case 4: return 'purple';
      case 5: return 'orange';
      case 6: return 'yellow';
      case 7: return 'black';
      case 8: return 'gray';
      default: return 'black';
    }
  };
  
  let minesTot = 75;
  return (
    <div>
      <div
        className="grid-container"
        style={{ gridTemplateColumns: `repeat(${cols}, 60px)` }}
      >
        {grid.flat().map(cell => {
          const classNames = ['grid-cell'];
          if (cell.revealed === true) classNames.push('revealed');
          if (cell.revealed === "green") classNames.push('green');
          if (cell.hasMine && cell.revealed) classNames.push('mine');
  
          return (
            <div
              key={`${cell.row}-${cell.col}`}
              className={classNames.join(' ')}
              onClick={() => handleCellClick(cell.row, cell.col)}
              onContextMenu={(e) => {
                e.preventDefault();
                handleRightClick(cell.row, cell.col);
              }}
            >
              {cell.flagged === uid && cell.revealed !== true
                ? <img src={flagImage}  alt="🚩" style={{ width: '72px', height: '72px' }} />
                : cell.flagged && cell.revealed !== true
                ? <img src={flagImage2}  alt="🚩" style={{ width: '72px', height: '72px' }} />
                : cell.revealed === true && cell.hasMine
                ? <img src={mineImage}  alt="💣" style={{ width: '72px', height: '72px' }} />
                : cell.revealed === true && cell.adiacent > 0
                ? <span style={{ color: getCellColor(cell.adiacent) }}>{cell.adiacent}</span>
                : ''}
            </div>
          );
        })}
      </div>
    </div>
  );
}
export default OnlineGameGrid;