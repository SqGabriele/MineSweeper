import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile} from "firebase/auth";
import { auth, db } from "../firebase";
import {doc, setDoc, getDocs, collection, query, where} from "firebase/firestore";
import { Icon } from '@iconify/react';
import { onAuthStateChanged } from "firebase/auth";
import "../App.css"

export default function AuthForm() {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState("");  
  const [email, setEmail] = useState("");        
  const [password, setPassword] = useState("");  
  const [confirmPassword, setConfirmPassword] = useState(""); 
  const [error, setError] = useState("");  
  const [success, setSuccess] = useState(""); 
  const [showPassword, setShowPassword] = useState(false); //mostra le password
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [selectGameMode, setSelectGameMode] = useState(false); //apre il dialog per la selezione della griglia

  //se sono già loggato vado in home
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user && navigator.onLine)
        navigate("/Home"); 
    });
    
    return () => unsubscribe();
  }, [navigate]);


  //prova a loggare
  const handleSubmit = async (e) => {
    e.preventDefault(); //non ricaricare la pagina
    setError("");
    setSuccess("");

    if (!isLogin && password !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
        setSuccess("Login successful!");
        navigate("/Home");
      } 
      else {  //registrati
        //chiedi al server se lo username esiste già
        const res = await fetch(`${import.meta.env.VITE_API_URL}/check-username`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username })
        });

        const result = await res.json();

        if (!res.ok) {
          setError(result.message);
          return;
        }

        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, { displayName: username });
        await setDoc(doc(db, "utenti", userCredential.user.uid), {uid: userCredential.user.uid,email,username,win:0, bestTime:"???", requests:[]}); //crea il doc nel database con id uid

        setSuccess("Registration completed!");
        navigate("/Home");
      }
    } catch (err) {
      if (err.code === "auth/invalid-credential") 
        setError("Wrong password. Try again.");
      else if (!navigator.onLine) 
        setError("You're offline. Click 'Play as a Guest'");
      else 
        setError("Error: " + err.message);
    }
  };

  return (
    <>
      <br/><br/><br/><br/><br/>
      <form onSubmit={handleSubmit} className="auth-form">
          <h2>{isLogin ? "Login" : "Sing up"}</h2>
          <br/>

          {!isLogin && <>
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required={!isLogin}
              disabled={isLogin}
              className="auth-input"
            />
            <br />
          </>}

          
          <input
            type="email"
            placeholder="Email"
            value={email}
            required={true}
            onChange={(e) => setEmail(e.target.value)}
            className={`auth-input`}
          />
          <br />
          

          <div className="password-wrapper">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="auth-input"
            />
            <span
              onClick={() => setShowPassword((prev) => !prev)}
              className="toggle-password"
              style={{ cursor: "pointer", marginLeft: "-30px" }}
            >
              {showPassword ? (
                <Icon icon="heroicons-solid:eye-slash"  className="h-5 w-5 text-gray-600" />
              ) : (
                <Icon icon="heroicons-solid:eye"  className="h-5 w-5 text-gray-600" />
              )}
            </span>
          </div>
          <br />

          {!isLogin && (
          <div className="password-wrapper">
            <input
              type={showConfirmPassword ? "text" : "password"}
              placeholder="Confirm password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="auth-input"
            />
            <span
              onClick={() => setShowConfirmPassword((prev) => !prev)}
              className="toggle-password"
              style={{ cursor: "pointer", marginLeft: "-30px" }}
            >
              {showConfirmPassword ? (
                <Icon icon="heroicons-solid:eye-slash"  className="h-5 w-5 text-gray-600" />
              ) : (
                <Icon icon="heroicons-solid:eye"  className="h-5 w-5 text-gray-600" />
              )}
            </span>
          </div>
          )}
          <br/><br/>
          <button type="submit" className="auth-button">{isLogin ? "Login" : "Sing up"}</button>

          {error && (<p className="error-message">{error}</p>)}
          {success && (<p className="success-message">{success}</p>)}

          <p style={{ marginTop: "1rem", textAlign: 'center' }}>
            <br/>
            <button
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="toggle-button"
                style={{fontFamily: "'Press Start 2P'", fontSize: "15px"}}
            >
                {isLogin ? "New? Singup" : "Login"}
            </button>
          </p>

          <div className="play-offline">
            <hr style={{ margin: "20px 0", borderColor: "#ddd", width: "300px" }} />
            <br/>
            <button onClick={() => setSelectGameMode(true)}>
              Play as a Guest
            </button>
          </div>
      </form>
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
    </>
  );
}
