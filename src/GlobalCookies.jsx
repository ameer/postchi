import React, { useState } from 'react';
import { Box, TextField, Button, Typography, Paper, Alert } from '@mui/material';

export default function GlobalCookies() {
  const [url, setUrl] = useState('');
  const [cookieString, setCookieString] = useState('');
  const [status, setStatus] = useState(null);

  const handleSaveCookies = async () => {
    if (!url || !cookieString) {
      setStatus({ type: 'error', msg: 'Both URL and Cookie String are required.' });
      return;
    }

    // Ensure the URL is valid so Electron's net module accepts it
    let targetUrl = url;
    if (!targetUrl.startsWith('http')) {
      targetUrl = `https://${targetUrl}`;
    }

    const result = await window.api.setGlobalCookies({ url: targetUrl, cookieString });
    
    if (result.success) {
      setStatus({ type: 'success', msg: 'Cookies injected into native session!' });
      setCookieString(''); // Clear after success
    } else {
      setStatus({ type: 'error', msg: `Failed: ${result.error}` });
    }
  };

  return (
    <Paper sx={{ p: 3, maxWidth: 600, mb: 4 }} variant="outlined">
      <Typography variant="h6" gutterBottom>Global Cookie Jar</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Paste raw cookies here. They will be natively attached to any scheduled requests matching the domain.
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <TextField
          label="Target URL or Domain (e.g., https://api.example.com)"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          size="small"
          fullWidth
        />
        
        <TextField
          label="Raw Cookie String"
          placeholder="session_id=xyz; cf_clearance=abc..."
          value={cookieString}
          onChange={(e) => setCookieString(e.target.value)}
          multiline
          rows={3}
          fullWidth
        />

        {status && <Alert severity={status.type}>{status.msg}</Alert>}

        <Button 
          variant="contained" 
          onClick={handleSaveCookies}
          sx={{ alignSelf: 'flex-start' }}
        >
          Inject Cookies
        </Button>
      </Box>
    </Paper>
  );
}