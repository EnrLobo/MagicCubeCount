import React, { useState, useEffect } from 'react';
import { auth, googleProvider } from './firebase';
import { signInWithPopup, onAuthStateChanged } from 'firebase/auth';
import TimerUI from './components/TimerUI';
import './index.css';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const loginWithGoogle = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Erro no login: ", error);
    }
  };

  if (loading) return <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">Carregando...</div>;

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center font-mono">
        <h1 className="text-4xl font-bold text-yellow-400 mb-8">Speedcubing Timer</h1>
        <p className="text-gray-400 mb-8 text-center max-w-md">
          Faça login para salvar seus tempos e competir no ranking contra seus amigos.
        </p>
        <button 
          onClick={loginWithGoogle}
          className="px-6 py-3 bg-white text-gray-900 font-bold rounded shadow hover:bg-gray-200 transition"
        >
          Entrar com Google
        </button>
      </div>
    );
  }

  return <TimerUI user={user} auth={auth} />;
}

export default App;