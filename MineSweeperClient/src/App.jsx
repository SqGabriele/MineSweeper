import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { onAuthStateChanged } from "firebase/auth";
import  React, { useEffect} from "react";
import { auth } from "./firebase";
import { subscribeUser } from "./notification";

import Game from './Pages/Game';
import Home from './Pages/Home';
import Login from './Pages/Login';
import Replay from './Pages/Replay';
import Coop from './Pages/Coop';

export default function App() {

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        if ("serviceWorker" in navigator && "PushManager" in window)
          subscribeUser(user.uid);
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/Home" element={<Home />} />
        <Route path="/Game" element={<Game />} />
        <Route path="/Replay" element={<Replay />} />
        <Route path="/Coop" element={<Coop />} />
      </Routes>
    </Router>
  )
}