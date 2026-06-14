import React, { useState, useEffect, useRef } from 'react';
import { Box, Typography, Paper, IconButton } from '@mui/material';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';

export default function LogConsole() {
  const [logs, setLogs] = useState([]);
  const bottomRef = useRef(null);

  useEffect(() => {
    // Subscribe to IPC log events
    window.api.onLog((newLog) => {
      setLogs((prev) => [...prev, newLog].slice(-200)); // Keep last 200 logs to prevent memory leaks
    });
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const clearLogs = () => setLogs([]);

  const getColor = (type) => {
    switch (type) {
      case 'success': return '#4caf50'; // Green
      case 'error': return '#f44336';   // Red
      case 'warn': return '#ff9800';    // Orange
      default: return '#bbdefb';        // Light Blue
    }
  };

  return (
    <Paper 
      elevation={3} 
      sx={{ 
        height: 250, 
        bgcolor: '#121212', 
        color: '#fff', 
        display: 'flex', 
        flexDirection: 'column',
        fontFamily: 'monospace',
        position: 'relative'
      }}
    >
      <Box sx={{ p: 1, borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: '#1e1e1e' }}>
        <Typography variant="caption" sx={{ fontWeight: 'bold', color: '#888' }}>
          TERMINAL OUTPUT
        </Typography>
        <IconButton size="small" onClick={clearLogs} sx={{ color: '#888' }} title="Clear Logs">
          <DeleteSweepIcon fontSize="small" />
        </IconButton>
      </Box>
      
      <Box sx={{ flexGrow: 1, overflowY: 'auto', p: 1 }}>
        {logs.length === 0 && (
          <Typography variant="caption" sx={{ color: '#555' }}>Awaiting execution...</Typography>
        )}
        {logs.map((log, index) => {
          const time = new Date(log.timestamp).toLocaleTimeString();
          return (
            <Box key={index} sx={{ display: 'flex', gap: 2, mb: 0.5, fontSize: '0.85rem' }}>
              <span style={{ color: '#666', minWidth: '80px' }}>[{time}]</span>
              <span style={{ color: getColor(log.type), wordBreak: 'break-all' }}>
                {log.message}
              </span>
            </Box>
          );
        })}
        <div ref={bottomRef} />
      </Box>
    </Paper>
  );
}