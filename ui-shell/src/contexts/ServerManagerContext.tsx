import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Command, Child } from '@tauri-apps/plugin-shell';

export type ServerStatus = 'stopped' | 'starting' | 'running' | 'stopping';

interface ServerManagerContextType {
  status: ServerStatus;
  logs: string[];
  restartCount: number;
  startServer: () => Promise<void>;
  stopServer: () => Promise<void>;
  restartServer: () => Promise<void>;
}

const ServerManagerContext = createContext<ServerManagerContextType | undefined>(undefined);

export const ServerManagerProvider = ({ children }: { children: ReactNode }) => {
  const [status, setStatus] = useState<ServerStatus>('stopped');
  const [logs, setLogs] = useState<string[]>([]);
  const [restartCount, setRestartCount] = useState<number>(0);
  const [childProcess, setChildProcess] = useState<Child | null>(null);

  const appendLog = (msg: string) => {
    setLogs(prev => [...prev, msg]);
  };

  const startServer = async () => {
    if (status === 'running' || status === 'starting') return;
    setStatus('starting');
    
    // Clear logs every 3 restarts
    const newRestartCount = restartCount + 1;
    if (newRestartCount % 3 === 0) {
      setLogs([]);
      appendLog('[System] Console auto-cleared (3 restarts reached).');
    }
    setRestartCount(newRestartCount);
    
    appendLog('[System] Starting Python backend server...');
    
    try {
      // In production, we'd bundle the python executable or rely on the system PATH.
      // Here we assume python is available in the shell PATH and we run it from the ui-shell directory context.
      const cmd = Command.create('python', ['-u', '../../backend/server.py']);
      
      cmd.on('close', data => {
        appendLog(`[System] Server process exited with code ${data.code}`);
        setStatus('stopped');
        setChildProcess(null);
      });
      
      cmd.on('error', error => {
        appendLog(`[System] Process Error: ${error}`);
        setStatus('stopped');
        setChildProcess(null);
      });
      
      cmd.stdout.on('data', line => appendLog(`[STDOUT] ${line}`));
      cmd.stderr.on('data', line => appendLog(`[STDERR] ${line}`));
      
      const child = await cmd.spawn();
      setChildProcess(child);
      setStatus('running');
      appendLog('[System] Server successfully attached and running (PID: ' + child.pid + ')');
    } catch (err) {
      appendLog(`[System] Failed to start server: ${err}`);
      setStatus('stopped');
    }
  };

  const stopServer = async () => {
    if (status === 'stopped' || status === 'stopping') return;
    setStatus('stopping');
    appendLog('[System] Stopping server...');
    
    if (childProcess) {
      try {
        await childProcess.kill();
        setStatus('stopped');
        setChildProcess(null);
        appendLog('[System] Server successfully stopped.');
      } catch (err) {
        appendLog(`[System] Failed to kill process: ${err}`);
        // Fallback status
        setStatus('running');
      }
    } else {
      setStatus('stopped');
    }
  };

  const restartServer = async () => {
    await stopServer();
    // Wait briefly for port to clear
    await new Promise(r => setTimeout(r, 1000));
    await startServer();
  };

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (childProcess) {
        childProcess.kill().catch(console.error);
      }
    };
  }, [childProcess]);

  return (
    <ServerManagerContext.Provider value={{ status, logs, restartCount, startServer, stopServer, restartServer }}>
      {children}
    </ServerManagerContext.Provider>
  );
};

export const useServerManager = () => {
  const context = useContext(ServerManagerContext);
  if (context === undefined) {
    throw new Error('useServerManager must be used within a ServerManagerProvider');
  }
  return context;
};
