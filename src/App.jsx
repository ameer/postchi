import React, { useState, useEffect } from 'react';
import { Box, Drawer, List, ListItemButton, ListItemText, Fab, Typography, Divider, IconButton } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import DeleteIcon from '@mui/icons-material/Delete';
import SessionForm from './SessionForm';
import GlobalCookies from './GlobalCookies';
import LogConsole from './LogConsole';
import CookieManager from './CookieManager';

const drawerWidth = 320;

export default function App() {
    const [view, setView] = useState('requests');
    const [sessions, setSessions] = useState([]);
    const [activeSessionId, setActiveSessionId] = useState(null);
    const [runningSessions, setRunningSessions] = useState(new Set()); // Track active timers
    const [toBeDeletedId, setToBeDeletedId] = useState(null)
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
        e.stopPropagation();

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

    const deleteSession = async (e, session) => {
        e.stopPropagation();
        setToBeDeletedId(session.id)
        const newSessions = sessions.filter(s => s.id !== session.id)
        setSessions(newSessions)
        await window.api.saveData({ sessions: newSessions });
        setToBeDeletedId(null)
    }

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
                    <List>
                        <ListItemButton selected={view === 'requests'} onClick={() => setView('requests')}>
                            <ListItemText primary="Request Schedules" />
                        </ListItemButton>
                        <ListItemButton selected={view === 'cookies'} onClick={() => setView('cookies')}>
                            <ListItemText primary="Cookie Manager" />
                        </ListItemButton>
                    </List>
                    {view === 'requests' && sessions.map((session) => (
                        <ListItemButton
                            key={session.id}
                            selected={activeSessionId === session.id}
                            onClick={() => setActiveSessionId(session.id)}
                            sx={{ pr: 1 }}
                        >
                            <ListItemText
                                primary={session.name}
                                secondary={`${session.method} - ${session.intervalMs}ms`}
                            />
                            <IconButton
                                onClick={(e) => toggleSessionState(e, session)}
                                color={runningSessions.has(session.id) ? "error" : "success"}
                            >
                                {runningSessions.has(session.id) ? <StopIcon /> : <PlayArrowIcon />}
                            </IconButton>
                            <IconButton
                                onClick={(e) => deleteSession(e, session)}
                                color="error"
                                disabled={runningSessions.has(session.id)}
                                loading={toBeDeletedId === session.id}
                            >
                                <DeleteIcon />
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
                {view === 'requests' ?
                    <SessionForm
                        key={activeSessionId || 'new'}
                        session={activeSession}
                        onSave={handleSaveSession}
                    /> :
                    <CookieManager />
                }
                <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider', bgcolor: 'background.default' }}>
                    <LogConsole />
                </Box>
            </Box>
        </Box>
    );
}