import React, { useEffect, useState, useRef } from 'react';
import { auth  } from "../firebase";
import seedrandom from 'seedrandom';
import flagImage from '../assets/flag.png';
import mineImage from '../assets/mine.png';
import "../App.css"

const GameGrid = ({ seed, start, rows = 10, cols = 10, mines = 15, setMines, isPlaying, resetSignal, setShowEndDialog, setGameResult, onMove, isReplay = false, LeftClick =null, RightClick =null, goBack=null}) => {
    const [grid, setGrid] = useState([]);
    const initialized = useRef(false);
    const gameEnded = useRef(false);
    const tilesLeft = useRef(rows*cols - mines);
    const isSeeded = useRef(seed.current!==null && !isReplay); //se è true è il problema del giorno

    //assegna le funzioni da usare in Replay
    useEffect(()=>{
      if(LeftClick !== null)
        LeftClick.current = handleCellClick;
      if(RightClick !== null)
        RightClick.current = handleRightClick;
      if(goBack !== null)
        goBack.current = backToOne;
    },[grid]);

  useEffect(() => {   
    initialized.current = false;
    gameEnded.current = false;
    tilesLeft.current = rows*cols - mines;
    if(!isSeeded.current && !isReplay)
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
    
    if(!isSeeded.current)
      setGrid(newGrid);
    else
      setGrid(generateGrid(start[0],start[1], newGrid));
  }, [resetSignal])

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
              setMines(prev => prev + 1);
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
      
            if ( newRow >= 0 && newRow < rows && newCol >= 0 && newCol < cols && grid[newRow][newCol].revealed !==true) {
              grid = revealGrid(grid, newRow, newCol);
            }
          }
        }
    
      return grid;
    };

    //vittoria o sconfitta
    const endGame = (win) =>{
      gameEnded.current = true;
      isPlaying(false);

      if(!win)
        showMines();

      setShowEndDialog(true);
      setGameResult(win ? "win" : "lose");
    }

    const handleCellClick = (row, col, force=false) => {
      if(gameEnded.current || (isReplay && !force)) return;
      if(!force && (grid[row][col].revealed===true || grid[row][col].flagged))
        return;

      //genera la griglia al primo click
      if (!initialized.current) {
        if(!isSeeded.current){
          const newGrid = generateGrid(row, col);
          setGrid(newGrid);
        }
        initialized.current = true;
        isPlaying(true);
        setTimeout(() => handleCellClick(row, col, force), 0);
        return;
      }

      if (onMove && !force) onMove(row, col, "left"); //salva la mossa

      //aggiorna la griglia rirenderizzando
      setGrid(prevGrid => {
        let updated = prevGrid.map(r => r.map(c => ({ ...c })));
        updated[row][col].revealed = true;
        tilesLeft.current--;

        if(updated[row][col].hasMine === false){
          updated = revealGrid(updated, row, col, true);
          if (tilesLeft.current === 0) 
            setTimeout(() => endGame(true), 0); // hai vinto
        }     
        else
          setTimeout(() => {endGame(false);},0); //hai perso
        return updated
      })
    }

    

    const handleRightClick = (row, col, force=false) => {
      if(gameEnded.current || (isReplay && !force)) return;
      let wasFlagged;

      if (onMove) onMove(row, col, "right");
    
      setGrid(prev => {
        const updated = prev.map(r => r.map(c => ({ ...c })));
        const cell = updated[row][col];
    
        if (cell.revealed !== true) {
          wasFlagged = cell.flagged;
          cell.flagged = !cell.flagged;
        }
      
        return updated;
      });
    
      setTimeout(() => {
          if (wasFlagged !== undefined) {
            setMines(prev => prev + (wasFlagged ? 1 : -1));
          }
      }, 0);
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

    //torna indietro con un solo render
    const backToOne = (moves, index) =>{
      initialized.current = false;
      gameEnded.current = false;
      tilesLeft.current = rows*cols - mines;

      //resetta la griglia
      let newGrid = Array(rows)
        .fill(null)
        .map((_, row) =>
        Array(cols)
          .fill(null)
          .map((_, col) => {
          return {
            row,
            col,
            hasMine: false,
            revealed: false,
            flagged: false,
            adiacent : 0,
          }
      }))
      for(let i = 0; i<index; i++){
        const move = moves[i];
        if (move.action === "left") { //tasto sinistro
          if (!initialized.current) { //primo tasto
            newGrid = generateGrid(move.row, move.col, newGrid);
            initialized.current = true;
          }

          let updated = newGrid.map(r => r.map(c => ({ ...c })));
          updated[move.row][move.col].revealed = true;

          if(updated[move.row][move.col].hasMine === false)
            updated = revealGrid(updated, move.row, move.col, true);
          newGrid = updated;

        } else if (move.action === "right") { //flag
          const updated = newGrid.map(r => r.map(c => ({ ...c })));
          const cell = updated[move.row][move.col];
      
          if (cell.revealed !== true) 
            cell.flagged = !cell.flagged;
        
          newGrid = updated;
        }
      }
      setGrid(newGrid);
    }
    
  
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
                {cell.flagged && cell.revealed !== true
                  ? <img src={flagImage}  alt="🚩" style={{ width: '72px', height: '72px' }} />
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
export default GameGrid;