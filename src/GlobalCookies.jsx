import React, { useState } from 'react';
import { Box, TextField, Button, Typography, Paper, Alert } from '@mui/material';

export default function GlobalCookies() {
  const [jsonInput, setJsonInput] = useState('');
  const [status, setStatus] = useState(null);

  const handleImportCookies = async () => {
    try {
      const parsed = JSON.parse(jsonInput);
      
      if (!Array.isArray(parsed)) {
        throw new Error("Invalid format: JSON must be an array of objects.");
      }

      const result = await window.api.setGlobalCookies(parsed);
      
      if (result.success) {
        setStatus({ type: 'success', msg: `Successfully injected ${parsed.length} cookies!` });
        setJsonInput(''); // Clear input
      } else {
        setStatus({ type: 'error', msg: `Failed: ${result.error}` });
      }
    } catch (e) {
      setStatus({ type: 'error', msg: `JSON Parsing Error: ${e.message}` });
    }
  };

  return (
    <Paper sx={{ p: 3, maxWidth: 600, mb: 4 }} variant="outlined">
      <Typography variant="h6" gutterBottom>Import Browser Cookies</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Paste the JSON array exported from your browser's extension.
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <TextField
          label="Paste JSON Array here"
          placeholder='[{"domain": ".example.com", "name": "...", "value": "..."}]'
          value={jsonInput}
          onChange={(e) => setJsonInput(e.target.value)}
          multiline
          rows={6}
          fullWidth
          fontFamily="monospace"
        />

        {status && <Alert severity={status.type}>{status.msg}</Alert>}

        <Button 
          variant="contained" 
          onClick={handleImportCookies}
          sx={{ alignSelf: 'flex-start' }}
        >
          Inject Cookies
        </Button>
      </Box>
    </Paper>
  );
}