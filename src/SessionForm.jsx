import React, { useState } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { Box, Button, TextField, IconButton, Stack, Typography, Paper, MenuItem, FormControlLabel, Switch } from '@mui/material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import dayjs from 'dayjs';
import { parseCurl } from './utils/parseCurl';

export default function SessionForm({ session, onSave }) {
    const [rawCurl, setRawCurl] = useState('');

    const { control, handleSubmit, reset } = useForm({
        defaultValues: session || {
            id: Date.now().toString(),
            name: 'New Session',
            url: '',
            method: 'GET',
            headers: [{ key: '', value: '' }],
            body: '',
            intervalMs: 5000, // default 5 seconds
            startTime: null, // Stored as ISO string
            endTime: null,    // Stored as ISO string
            stopOnError: false // NEW: Default to false
        }
    });

    const { fields, append, remove } = useFieldArray({ control, name: 'headers' });

    const handleCurlPaste = (e) => {
        const pasted = e.target.value;
        setRawCurl(pasted);
        const parsed = parseCurl(pasted);

        if (parsed) {
            reset({
                ...control._defaultValues, // keep id and name
                url: parsed.url,
                method: parsed.method,
                headers: parsed.headers,
                body: parsed.body
            });
            setRawCurl(''); // clear field after successful parse
        }
    };

    const onSubmit = (data) => {
        onSave(data);
    };

    return (
        <Box component="form" onSubmit={handleSubmit(onSubmit)} sx={{ p: 3, maxWidth: 800 }}>
            <Stack spacing={3}>
                <TextField
                    label="Paste cURL Command here to auto-fill"
                    multiline
                    rows={3}
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
                            <TextField {...field} select label="Method" sx={{ width: 120 }}>
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
                    <Typography variant="subtitle2" sx={{ mb: 2 }}>Headers</Typography>
                    <Stack spacing={2}>
                        {fields.map((item, index) => (
                            <Stack direction="row" spacing={2} key={item.id} alignItems="center">
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
                                <IconButton onClick={() => remove(index)} color="error" size="small">
                                    <DeleteIcon />
                                </IconButton>
                            </Stack>
                        ))}
                    </Stack>
                    <Button startIcon={<AddIcon />} onClick={() => append({ key: '', value: '' })} sx={{ mt: 2 }} size="small">
                        Add Header
                    </Button>
                </Paper>

                <Button type="submit" variant="contained" size="large">Save Session</Button>
            </Stack>
        </Box>
    );
}