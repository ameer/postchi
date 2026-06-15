import React, { useState } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { Box, Button, TextField, IconButton, Stack, Typography, Paper, MenuItem, FormControlLabel, Switch, Alert } from '@mui/material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import FormatLeftIcon from '@mui/icons-material/FormatIndentIncrease';
import dayjs from 'dayjs';
import CodeMirror from '@uiw/react-codemirror';
import { json } from '@codemirror/lang-json';

export default function SessionForm({ session, onSave }) {
    const [rawCurl, setRawCurl] = useState('');
    const [jsonError, setJsonError] = useState(null);

    // Baseline clean schema shape tracking
    const fallbackDefaultValues = {
        id: Date.now().toString(),
        name: 'New Session',
        url: '',
        method: 'GET',
        headers: [{ key: '', value: '' }],
        body: '', // Switched from array to string representation schema
        intervalMs: 5000,
        startTime: null,
        endTime: null,
        stopOnError: false,
        cookies: [{ key: '', value: '' }]
    };
    const getNormalizedDefaultValues = () => {
        if (!session) return fallbackDefaultValues;

        let normalizedBody = session.body;

        // If the saved session body is an object or array, safely stringify it
        if (normalizedBody && typeof normalizedBody === 'object') {
            try {
                normalizedBody = JSON.stringify(normalizedBody, null, 2);
            } catch (e) {
                normalizedBody = '';
            }
        } else if (normalizedBody === undefined || normalizedBody === null) {
            normalizedBody = '';
        }

        return {
            ...fallbackDefaultValues,
            ...session,
            body: normalizedBody // Ensured to be a string
        };
    };
    const { control, handleSubmit, reset, watch, setValue } = useForm({
        defaultValues: getNormalizedDefaultValues()
    });

    const currentMethod = watch('method');
    const currentBody = watch('body');

    const { fields: headerFields, append: appendHeader, remove: removeHeader } = useFieldArray({ control, name: 'headers' });
    const { fields: cookieFields, append: appendCookie, remove: removeCookie } = useFieldArray({ control, name: "cookies" });

    // Validate real-time format shifts safely
    React.useEffect(() => {
        if (!currentBody) {
            setJsonError(null);
            return;
        }
        try {
            JSON.parse(currentBody);
            setJsonError(null);
        } catch (e) {
            setJsonError(`Malformed JSON syntax: ${e.message}`);
        }
    }, [currentBody]);
    React.useEffect(() => {
        reset(getNormalizedDefaultValues());
    }, [session, reset]);
    const handleCurlPaste = async (e) => {
        const pasted = e.target.value;
        if (!pasted) { setRawCurl(''); return; }

        const result = await window.api.parseCurl(pasted);

        if (result.success) {
            let processedBody = result.data.body || '';

            // Auto-format body payloads immediately if clean JSON signatures match
            try {
                if (typeof processedBody === 'string' && processedBody.trim().startsWith('{')) {
                    processedBody = JSON.stringify(JSON.parse(processedBody), null, 2);
                }
            } catch (err) {
                // Fail silently and keep fallback text parameters
            }

            reset({
                id: Date.now().toString(),
                name: 'Parsed Session',
                url: result.data.url || '',
                method: result.data.method || 'GET',
                headers: result.data.headers || [],
                cookies: Array.isArray(result.data.cookies)
                    ? result.data.cookies.map(({ name, value }) => ({ key: name, value }))
                    : [],
                body: processedBody,
                intervalMs: 5000,
                stopOnError: false,
                startTime: null,
                endTime: null
            });
        } else {
            alert("Invalid cURL sequence data structure verification rule mismatch: " + result.error);
        }
        setRawCurl('');
    };

    const handleBeautifyJSON = () => {
        try {
            if (currentBody && currentBody.trim()) {
                const formatted = JSON.stringify(JSON.parse(currentBody), null, 2);
                setValue('body', formatted, { shouldValidate: true });
                setJsonError(null);
            }
        } catch (e) {
            setJsonError("Formatting aborted. Fix current syntax configurations first.");
        }
    };

    const onSubmit = (data) => {
        if (jsonError && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(data.method.toUpperCase())) {
            if (!confirm("Your request payload body contains bad syntax layout rules. Save anyway?")) return;
        }
        onSave(data);
    };

    const showBodyInput = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(currentMethod?.toUpperCase());

    return (
        <Box component="form" onSubmit={handleSubmit(onSubmit)} sx={{ p: 3 }}>
            <Stack spacing={3}>
                <TextField
                    label="Paste cURL Command here to auto-fill"
                    multiline
                    rows={2}
                    value={rawCurl}
                    onChange={handleCurlPaste}
                    placeholder="curl 'https://api.example.com' -H 'Authorization: Bearer ...'"
                    fullWidth
                />

                <Stack direction="row" spacing={2}>
                    <Controller
                        name="name"
                        control={control}
                        render={({ field }) => <TextField {...field} label="Session Name" fullWidth />}
                    />
                    <Controller
                        name="intervalMs"
                        control={control}
                        render={({ field }) => <TextField {...field} label="Interval (ms)" type="number" sx={{ width: 200 }} />}
                    />
                    <Controller
                        name="stopOnError"
                        control={control}
                        render={({ field }) => (
                            <FormControlLabel
                                control={<Switch checked={field.value} onChange={field.onChange} color="error" />}
                                label="Stop on 4xx/5xx"
                                sx={{ ml: 1 }}
                            />
                        )}
                    />
                </Stack>

                <Paper variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="subtitle2" sx={{ mb: 2 }}>Schedule Rules (Optional)</Typography>
                    <Stack direction="row" spacing={2}>
                        <Controller
                            name="startTime"
                            control={control}
                            render={({ field }) => (
                                <DateTimePicker
                                    disablePast
                                    ampm={false}
                                    label="Start Time (Leave blank for 'Now')"
                                    value={field.value ? dayjs(field.value) : null}
                                    onChange={(newValue) => field.onChange(newValue ? newValue.toISOString() : null)}
                                    slotProps={{ textField: { fullWidth: true } }}
                                />
                            )}
                        />
                        <Controller
                            name="endTime"
                            control={control}
                            render={({ field }) => (
                                <DateTimePicker
                                    disablePast
                                    ampm={false}
                                    label="End Time (Leave blank for 'Never')"
                                    value={field.value ? dayjs(field.value) : null}
                                    onChange={(newValue) => field.onChange(newValue ? newValue.toISOString() : null)}
                                    slotProps={{ textField: { fullWidth: true } }}
                                />
                            )}
                        />
                    </Stack>
                </Paper>

                <Stack direction="row" spacing={2}>
                    <Controller
                        name="method"
                        control={control}
                        render={({ field }) => (
                            <TextField {...field} select label="Method" sx={{ width: 140 }}>
                                {['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].map((m) => (
                                    <MenuItem key={m} value={m}>{m}</MenuItem>
                                ))}
                            </TextField>
                        )}
                    />
                    <Controller
                        name="url"
                        control={control}
                        render={({ field }) => <TextField {...field} label="Request URL" fullWidth />}
                    />
                </Stack>

                <Paper variant="outlined" sx={{ p: 2 }}>
                    {/* Headers Management Group */}
                    <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 'bold' }}>Headers</Typography>
                    <Stack spacing={1.5}>
                        {headerFields.map((item, index) => (
                            <Stack direction="row" spacing={2} key={item.id} sx={{ alignItems: 'center' }}>
                                <Controller
                                    name={`headers.${index}.key`}
                                    control={control}
                                    render={({ field }) => <TextField {...field} label="Key" size="small" fullWidth />}
                                />
                                <Controller
                                    name={`headers.${index}.value`}
                                    control={control}
                                    render={({ field }) => <TextField {...field} label="Value" size="small" fullWidth />}
                                />
                                <IconButton onClick={() => removeHeader(index)} color="error" size="small">
                                    <DeleteIcon />
                                </IconButton>
                            </Stack>
                        ))}
                    </Stack>
                    <Button startIcon={<AddIcon />} onClick={() => appendHeader({ key: '', value: '' })} sx={{ mt: 1.5 }} size="small" variant="outlined">
                        Add Header
                    </Button>

                    {/* Cookie Management Group */}
                    <Typography variant="subtitle2" sx={{ mt: 3, mb: 2, fontWeight: 'bold' }}>Session Specific Cookies</Typography>
                    <Stack spacing={1.5}>
                        {cookieFields.map((field, index) => (
                            <Stack direction="row" spacing={2} key={field.id} sx={{ alignItems: 'center' }}>
                                <Controller
                                    name={`cookies.${index}.key`}
                                    control={control}
                                    render={({ field }) => <TextField {...field} label="Cookie Name" size="small" fullWidth />}
                                />
                                <Controller
                                    name={`cookies.${index}.value`}
                                    control={control}
                                    render={({ field }) => <TextField {...field} label="Value" size="small" fullWidth />}
                                />
                                <IconButton onClick={() => removeCookie(index)} color="error" size="small">
                                    <DeleteIcon />
                                </IconButton>
                            </Stack>
                        ))}
                    </Stack>
                    <Button startIcon={<AddIcon />} onClick={() => appendCookie({ key: '', value: '' })} sx={{ mt: 1.5 }} size="small" variant="outlined">
                        Add Cookie
                    </Button>

                    {/* Unified Postman-Style JSON Payload Field */}
                    {showBodyInput && (
                        <Box sx={{ mt: 4 }}>
                            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                                    Body Payload Raw (JSON Configuration)
                                </Typography>
                                <Button
                                    size="small"
                                    variant="text"
                                    startIcon={<FormatLeftIcon />}
                                    onClick={handleBeautifyJSON}
                                    disabled={!currentBody}
                                >
                                    Prettify JSON
                                </Button>
                            </Stack>

                            <Paper
                                variant="outlined"
                                sx={{
                                    overflow: 'hidden',
                                    borderColor: jsonError ? 'error.main' : 'divider',
                                    '& .cm-editor': {
                                        fontFamily: 'Consolas, Monaco, monospace',
                                        fontSize: '0.9rem',
                                        backgroundColor: 'background.paper',
                                    },
                                    '& .cm-gutters': {
                                        backgroundColor: 'action.hover',
                                        borderRight: '1px solid',
                                        borderColor: 'divider',
                                        color: 'text.secondary'
                                    }
                                }}
                            >
                                <Controller
                                    name="body"
                                    control={control}
                                    render={({ field }) => (
                                        <CodeMirror
                                            value={typeof field.value === 'string' ? field.value : ''}
                                            height="250px"
                                            extensions={[json()]}
                                            onChange={(value) => field.onChange(value)}
                                            placeholder='{\n  "key": "value"\n}'
                                            theme="dark" // Switch to "dark" if your app uses a dark theme layout
                                            basicSetup={{
                                                lineNumbers: true,
                                                foldGutter: true,
                                                dropCursor: true,
                                                allowMultipleSelections: false,
                                                indentOnInput: true,
                                                bracketMatching: true,
                                                closeBrackets: true,
                                                autocompletion: true,
                                                highlightActiveLine: true
                                            }}
                                        />
                                    )}
                                />
                            </Paper>

                            {jsonError && (
                                <Alert severity="warning" sx={{ mt: 1, py: 0 }}>
                                    {jsonError}
                                </Alert>
                            )}
                        </Box>
                    )}
                </Paper>

                <Button type="submit" variant="contained" size="large" color="primary">Save Session Configuration</Button>
            </Stack>
        </Box>
    );
}