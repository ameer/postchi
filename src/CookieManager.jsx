import React, { useState, useEffect } from 'react';
import { Box, TextField, Button, Typography, Paper, Alert, Grid, Card, CardContent, IconButton, Divider } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import RefreshIcon from '@mui/icons-material/Refresh';

export default function CookieManager() {
  const [cookies, setCookies] = useState([]);
  const [jsonInput, setJsonInput] = useState('');
  const [status, setStatus] = useState(null);

  const loadCookies = async () => {
    const list = await window.api.getCookies();
    setCookies(list);
  };

  useEffect(() => { loadCookies(); }, []);

  const handleImport = async () => {
    try {
      const parsed = JSON.parse(jsonInput);
      await window.api.setGlobalCookies(parsed);
      setStatus({ type: 'success', msg: `Injected ${parsed.length} cookies.` });
      setJsonInput('');
      loadCookies(); // Refresh list
    } catch (e) {
      setStatus({ type: 'error', msg: 'Invalid JSON format.' });
    }
  };

  const handleDelete = async (url, name) => {
    await window.api.removeCookie({ url, name });
    loadCookies(); // Refresh list
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>Cookie Manager</Typography>
      
      {/* Import Section */}
      <Paper sx={{ p: 3, mb: 4 }} variant="outlined">
        <Typography variant="h6">Import Cookies</Typography>
        <TextField fullWidth multiline rows={4} value={jsonInput} onChange={(e) => setJsonInput(e.target.value)} sx={{ my: 2 }} />
        <Button variant="contained" onClick={handleImport}>Inject Cookies</Button>
      </Paper>

      {/* List Section */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">Active Cookies ({cookies.length})</Typography>
        <IconButton onClick={loadCookies}><RefreshIcon /></IconButton>
      </Box>

      <Grid container spacing={2}>
        {cookies.map((c, i) => (
          <Grid item xs={12} md={6} key={i}>
            <Card variant="outlined">
              <CardContent sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="subtitle2" color="primary">{c.name}</Typography>
                  <Typography variant="caption" display="block" noWrap>{c.domain}</Typography>
                </Box>
                <IconButton color="error" onClick={() => handleDelete(c.url, c.name)}>
                  <DeleteIcon />
                </IconButton>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}