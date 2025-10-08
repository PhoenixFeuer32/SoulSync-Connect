import { useState, useEffect } from 'react';
import { useWebSocket } from './use-websocket';

interface SystemStatus {
  overall: string;
  kindroid: string;
  elevenlabs: string;
  twilio: string;
  database: string;
}

interface Metrics {
  kindroid?: { latency: string };
  elevenlabs?: { latency: string };
  twilio?: { latency: string };
}

interface UseRealTimeDataReturn {
  systemStatus: SystemStatus | null;
  metrics: Metrics | null;
  callStatus: any;
  errors: any[];
  isConnected: boolean;
}

export function useRealTimeData(): UseRealTimeDataReturn {
  const { isConnected, lastMessage } = useWebSocket();
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>({
    overall: 'optimal',
    kindroid: 'connected',
    elevenlabs: 'connected',
    twilio: 'connected',
    database: 'healthy'
  });
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [callStatus, setCallStatus] = useState(null);
  const [errors, setErrors] = useState<any[]>([]);

  useEffect(() => {
    if (lastMessage) {
      switch (lastMessage.type) {
        case 'system_status_update':
          setSystemStatus(lastMessage.data);
          break;
        case 'metrics_update':
          setMetrics(lastMessage.data);
          break;
        case 'call_status_update':
          setCallStatus(lastMessage.data);
          break;
        case 'error_logged':
          setErrors(prev => [lastMessage.data, ...prev].slice(0, 100));
          break;
        default:
          break;
      }
    }
  }, [lastMessage]);

  return {
    systemStatus,
    metrics,
    callStatus,
    errors,
    isConnected,
  };
}
