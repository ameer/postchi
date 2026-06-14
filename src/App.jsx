import React, { useState, useEffect } from 'react';
import { Box, Drawer, List, ListItemButton, ListItemText, Fab, Typography, Divider, IconButton } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import SessionForm from './SessionForm';
import GlobalCookies from './GlobalCookies';
import LogConsole from './LogConsole';

const drawerWidth = 320;

export default function App() {
    const [sessions, setSessions] = useState([]);
    const [activeSessionId, setActiveSessionId] = useState(null);
    const [runningSessions, setRunningSessions] = useState(new Set()); // Track active timers

    useEffect(() => {
        window.api.onSessionStopped((stoppedId) => {
            setRunningSessions(prev => {
                const next = new Set(prev);
                next.delete(stoppedId);
                return next;
            });
        });
        const loadState = async () => {
            const data = await window.api.loadData();
            if (data && data.sessions) {
                setSessions(data.sessions);
                if (data.sessions.length > 0) setActiveSessionId(data.sessions[0].id);
            }
        };
        loadState();
    }, []);

    const handleSaveSession = async (updatedSession) => {
        let newSessions;
        const exists = sessions.find(s => s.id === updatedSession.id);
        if (exists) {
            newSessions = sessions.map(s => s.id === updatedSession.id ? updatedSession : s);
        } else {
            newSessions = [...sessions, updatedSession];
        }
        setSessions(newSessions);
        await window.api.saveData({ sessions: newSessions });

        // Auto-select newly created sessions
        if (!exists) setActiveSessionId(updatedSession.id);
    };

    const toggleSessionState = async (e, session) => {
        e.stopPropagation(); // Prevent opening the form when just clicking play/stop

        const isRunning = runningSessions.has(session.id);
        if (isRunning) {
            await window.api.stopSession(session.id);
            setRunningSessions(prev => {
                const next = new Set(prev);
                next.delete(session.id);
                return next;
            });
        } else {
            await window.api.startSession(session);
            setRunningSessions(prev => {
                const next = new Set(prev);
                next.add(session.id);
                return next;
            });
        }
    };

    const activeSession = sessions.find(s => s.id === activeSessionId) || null;

    return (
        <Box sx={{ display: 'flex', height: '100vh' }}>
            <Drawer
                variant="permanent"
                sx={{
                    width: drawerWidth,
                    flexShrink: 0,
                    '& .MuiDrawer-paper': { width: drawerWidth, boxSizing: 'border-box' },
                }}
            >
                <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="h6">Request Schedules</Typography>
                </Box>
                <Divider />
                <List>
                    {sessions.map((session) => (
                        <ListItemButton
                            key={session.id}
                            selected={activeSessionId === session.id}
                            onClick={() => setActiveSessionId(session.id)}
                            sx={{ pr: 1 }}
                        >
                            <ListItemText
                                primary={session.name}
                                secondary={`${session.method} - ${session.intervalMs}ms`}
                                primaryTypographyProps={{
                                    color: runningSessions.has(session.id) ? 'success.main' : 'text.primary',
                                    fontWeight: runningSessions.has(session.id) ? 'bold' : 'normal'
                                }}
                            />
                            <IconButton
                                onClick={(e) => toggleSessionState(e, session)}
                                color={runningSessions.has(session.id) ? "error" : "success"}
                            >
                                {runningSessions.has(session.id) ? <StopIcon /> : <PlayArrowIcon />}
                            </IconButton>
                        </ListItemButton>
                    ))}
                </List>
                <Fab
                    color="primary"
                    onClick={() => setActiveSessionId(null)}
                    sx={{ position: 'absolute', bottom: 16, right: 16 }}
                >
                    <AddIcon />
                </Fab>
            </Drawer>
            <Box component="main" sx={{ flexGrow: 1, p: 3, overflow: 'auto' }}>
                <SessionForm
                    key={activeSessionId || 'new'}
                    session={activeSession}
                    onSave={handleSaveSession}
                />
                <GlobalCookies />
                <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider', bgcolor: 'background.default' }}>
                    <LogConsole />
                </Box>
            </Box>
        </Box>
    );
}