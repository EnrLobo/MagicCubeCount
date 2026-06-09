import { useState, useEffect, useRef } from 'react';

export const useStackmatTimer = () => {
  // states: 'idle', 'ready', 'running', 'stopped'
  const [timerState, setTimerState] = useState('idle');
  const [time, setTime] = useState(0);
  
  const startTimeRef = useRef(0);
  const animationFrameRef = useRef(null);

  const updateTimer = () => {
    setTime(Date.now() - startTimeRef.current);
    animationFrameRef.current = requestAnimationFrame(updateTimer);
  };

  const startHolding = () => {
    if (timerState === 'idle' || timerState === 'stopped') {
      setTimerState('ready'); // Agora arma instantaneamente!
      setTime(0);
    } else if (timerState === 'running') {
      stopTimer();
    }
  };

  const releaseHolding = () => {
    if (timerState === 'ready') {
      startTimeRef.current = Date.now();
      setTimerState('running');
      animationFrameRef.current = requestAnimationFrame(updateTimer);
    }
  };

  const stopTimer = () => {
    if (timerState === 'running') {
      cancelAnimationFrame(animationFrameRef.current);
      setTime(Date.now() - startTimeRef.current);
      setTimerState('stopped');
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.repeat) return; // Ignora se o usuário segurar o botão
      
      if (e.code === 'Space' && (timerState === 'idle' || timerState === 'stopped')) {
        e.preventDefault();
        startHolding();
      } else if (timerState === 'running') {
        e.preventDefault();
        stopTimer();
      }
    };

    const handleKeyUp = (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        releaseHolding();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [timerState]);

  const resetTimer = () => {
    setTimerState('idle');
    setTime(0);
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
  };

  return { timerState, time, resetTimer, startHolding, releaseHolding };
};