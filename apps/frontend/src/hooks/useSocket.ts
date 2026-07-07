import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { toast } from 'sonner';
import { useAuthStore } from '../stores/authStore';
import { useSimulationStore } from '../stores/simulationStore';
import { config } from '../lib/config';
import { normalizeRole } from '../lib/normalizeRole';

// Native AudioContext beep generator to play a subtle sound without external MP3 files
function playNotificationSound() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const audioCtx = new AudioContextClass();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
    oscillator.frequency.exponentialRampToValueAtTime(783.99, audioCtx.currentTime + 0.12); // G5
    
    gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.25);
    
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.25);
  } catch (err) {
    console.warn("Failed to play notification audio chime:", err);
  }
}

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);
  const { user, isAuthenticated, loading } = useAuthStore();
  const {
    activeSimulation,
    fetchLatestState,
    fetchMetrics,
    fetchSnapshots,
    setStatus,
    setIsLoading,
  } = useSimulationStore();

  const simulationId = activeSimulation?.id;
  const userId = user?.id;

  useEffect(() => {
    if (loading || !isAuthenticated || !userId) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return;
    }

    // Trigger initial fetch of the active simulation session
    fetchLatestState();

    console.log(`🔌 Establishing WebSocket connection to: ${config.socketUrl}`);
    const socket = io(config.socketUrl, {
      transports: ['websocket'],
      withCredentials: true, // Sends session cookie automatically
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('✅ Real-time Socket.io connected. Socket ID:', socket.id);
      toast.dismiss('socket-offline');
      
      // Join user personal channel
      socket.emit('join-user', userId);
      
      // Join active simulation observer channel
      if (simulationId) {
        socket.emit('join-simulation', simulationId);
      }

      // Join instructor channel if role matches
      const userRole = normalizeRole(user?.role);
      if (userRole === 'INSTRUCTOR') {
        console.log(`🔌 Joining instructor room: instructor:${userId}`);
        socket.emit('join-instructor', userId);
      }
    });

    socket.on('disconnect', (reason) => {
      console.warn('⚠️ Real-time Socket.io disconnected:', reason);
      if (reason === 'io server disconnect' || reason === 'transport close' || reason === 'ping timeout') {
        toast.warning("Real-time connection lost. Reconnecting...", {
          id: 'socket-offline',
          duration: Infinity,
        });
      }
    });

    // Real-time Event Subscriptions
    socket.on('round:complete', async (payload: any) => {
      console.log('🎉 WebSocket round:complete event payload:', payload);
      playNotificationSound();
      toast.success(`Round ${payload.roundNumber || ''} results are ready!`, { duration: 5000 });
      
      // Reload current simulation data, metrics, and snapshots
      if (simulationId) {
        await fetchLatestState();
        await Promise.all([
          fetchMetrics(),
          fetchSnapshots()
        ]);
        try {
          const { useLeaderboardStore } = await import('../stores/leaderboardStore');
          await useLeaderboardStore.getState().fetchLeaderboard();
        } catch (err) {
          console.warn("Failed to refresh classmate leaderboard on socket update:", err);
        }
      }
      setIsLoading(false);
    });

    socket.on('decision:locked', (payload: any) => {
      console.log('🔒 WebSocket decision:locked event:', payload);
      setStatus('LOCKED');
      toast.info("Decisions have been locked for processing.");
    });

    socket.on('event:triggered', (payload: any) => {
      console.log('⚡ WebSocket event:triggered event:', payload);
      // Dispatch standard browser CustomEvent so UI modals can catch and show EventAlert
      const customEvent = new CustomEvent('sim-market-event-triggered', { detail: payload });
      window.dispatchEvent(customEvent);
    });

    socket.on('notification', (notice: any) => {
      console.log('🔔 WebSocket notification event:', notice);
      toast.info(notice.message || JSON.stringify(notice));
    });

    return () => {
      console.log('🔌 Cleaning up WebSocket connections.');
      socket.disconnect();
      socketRef.current = null;
    };
  }, [isAuthenticated, userId, user?.role, loading, simulationId, fetchMetrics, fetchSnapshots, setStatus]);

  return socketRef.current;
}

export default useSocket;
