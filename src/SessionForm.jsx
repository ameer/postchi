import React, { useState } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { Box, Button, TextField, IconButton, Stack, Typography, Paper, MenuItem, FormControlLabel, Switch } from '@mui/material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import dayjs from 'dayjs';
import { convertObjectToArray } from './utils/helpers';

export default function SessionForm({ session, onSave }) {
    const [rawCurl, setRawCurl] = useState('');

    const { control, handleSubmit, reset } = useForm({
        defaultValues: session || {
            id: Date.now().toString(),
            name: 'New Session',
            url: '',
            method: 'get',
            headers: [{ key: '', value: '' }],
            body: [{ key: '', value: '' }],
            intervalMs: 5000,
            startTime: null,
            endTime: null,
            stopOnError: false,
            cookies: [{ key: '', value: '' }]
        }
    });

    const { fields: headerFields, append: appendHeader, remove: removeHeader } = useFieldArray({ control, name: 'headers' });
    const { fields: cookieFields, append: appendCookie, remove: removeCookie } = useFieldArray({ control, name: "cookies" });
    const { fields: bodyFields, append: appendBody, remove: removeBody } = useFieldArray({ control, name: "body" });
    const handleCurlPaste = async (e) => {

        if (!e.target.value) { setRawCurl(''); return }
        const pasted = e.target.value;
        const result = await window.api.parseCurl(pasted);
        console.log(result.data);

        if (result.success) {
            reset({
                ...control._defaultValues,
                ...result.data,
                body: convertObjectToArray(result.data.body),
                cookies: Array.isArray(result.data.cookies) ? result.data.cookies.map(({name, value}) => ({key: name, value})) : convertObjectToArray(result.data.cookies),
                id: Date.now().toString(),
                name: 'Parsed Session',
            });
        } else {
            alert("Invalid cURL: " + result.error);
        }
        setRawCurl('')
    };

    const onSubmit = (data) => {
        onSave(data);
    };
    const test = () => {
        console.log(bodyFields);

    }
    return (
        <Box component="form" onSubmit={handleSubmit(onSubmit)} sx={{ p: 3 }}>
            <Button onClick={test}>Click here</Button>
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
                                    disablePast
                                    ampm={false}
                                    views={['year', 'month', 'day', 'hours', 'minutes', 'seconds']}
                                    timeSteps={{ hours: 1, minutes: 1, seconds: 1 }}
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
                                    views={['year', 'month', 'day', 'hours', 'minutes', 'seconds']}
                                    timeSteps={{ hours: 1, minutes: 1, seconds: 1 }}
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
                                    <MenuItem key={m} value={m.toLowerCase()}>{m}</MenuItem>
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
                    <Button startIcon={<AddIcon />} onClick={() => appendHeader({ key: '', value: '' })} sx={{ mt: 2 }} size="small">
                        Add Header
                    </Button>
                    <Typography variant="h6" sx={{ mt: 3, mb: 1 }}>Session Cookies</Typography>
                    <Stack spacing={1}>
                        {cookieFields.map((field, index) => (
                            <Stack direction="row" spacing={1} key={field.id}>
                                <Controller
                                    name={`cookies.${index}.key`}
                                    control={control}
                                    render={({ field }) => <TextField {...field} label="Key" size="small" fullWidth />}
                                />
                                <Controller
                                    name={`cookies.${index}.value`}
                                    control={control}
                                    render={({ field }) => <TextField {...field} label="Value" size="small" fullWidth />}
                                />
                                <IconButton onClick={() => removeCookie(index)} color="error">
                                    <DeleteIcon />
                                </IconButton>
                            </Stack>
                        ))}
                        <Button
                            startIcon={<AddIcon />}
                            onClick={() => appendCookie({ name: '', value: '' })}
                            variant="outlined"
                            sx={{ alignSelf: 'flex-start' }}
                        >
                            Add Cookie
                        </Button>
                    </Stack>
                    <Typography variant="h6" sx={{ mt: 3, mb: 1 }}>Body fields</Typography>
                    <Stack spacing={1}>
                        {bodyFields.map((field, index) => (
                            <Stack direction="row" spacing={1} key={field.key}>
                                <Controller
                                    name={`body.${index}.key`}
                                    control={control}
                                    render={({ field }) => <TextField {...field} label="Key" size="small" fullWidth />}
                                />
                                <Controller
                                    name={`body.${index}.value`}
                                    control={control}
                                    render={({ field }) => <TextField {...field} label="Value" size="small" fullWidth />}
                                />
                                <IconButton onClick={() => removeBody(index)} color="error">
                                    <DeleteIcon />
                                </IconButton>
                            </Stack>
                        ))}
                        <Button
                            startIcon={<AddIcon />}
                            onClick={() => appendBody({ key: '', value: '' })}
                            variant="outlined"
                            sx={{ alignSelf: 'flex-start' }}
                        >
                            Add Field
                        </Button>
                    </Stack>
                </Paper>

                <Button type="submit" variant="contained" size="large">Save Session</Button>
            </Stack>
        </Box>
    );
}