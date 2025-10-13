import React, { useEffect, useState } from "react";
import axios from "axios";
import CONFIG from "../config/config";
import {
    Box,
    Card,
    CardContent,
    Typography,
    List,
    ListItem,
    ListItemIcon,
    ListItemText,
    CircularProgress,
    Fade,
    Menu,
    MenuItem,
    IconButton,
    Chip,
    useMediaQuery,
    useTheme,
    AppBar,
    Toolbar,
    Container,
} from "@mui/material";
import PersonIcon from "@mui/icons-material/Person";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import FilterListIcon from "@mui/icons-material/FilterList";

const GoogleSheetReader = () => {
    const [groupedData, setGroupedData] = useState({});
    const [loading, setLoading] = useState(true);
    const [sortType, setSortType] = useState("chronological");
    const [anchorEl, setAnchorEl] = useState(null);

    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

    useEffect(() => {
        const fetchSheetData = async () => {
            const { SHEET_ID, API_KEY, RANGE } = CONFIG;
            const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(
                RANGE
            )}?key=${API_KEY}`;

            try {
                const res = await axios.get(url);
                const values = res.data.values || [];

                if (values.length < 2) {
                    setGroupedData({});
                    setLoading(false);
                    return;
                }

                const header = values[0];
                const dataRows = values.slice(1);

                const nameIndex = header.findIndex((h) =>
                    h.toLowerCase().includes("nome")
                );
                const dateIndex = header.findIndex((h) =>
                    h.toLowerCase().includes("quando")
                );

                const grouped = {};

                dataRows.forEach((row) => {
                    const name = row[nameIndex];
                    const datesRaw = row[dateIndex];
                    if (!datesRaw || !name) return;

                    const dates = datesRaw
                        .split(/[,;]+/)
                        .map((d) => d.trim())
                        .filter((d) => d.length > 0);

                    dates.forEach((date) => {
                        if (!grouped[date]) grouped[date] = [];
                        if (!grouped[date].includes(name)) {
                            grouped[date].push(name);
                        }
                    });
                });

                setGroupedData(grouped);
            } catch (err) {
                console.error("Errore nel caricamento dei dati:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchSheetData();
    }, []);

    const formatItalianDate = (dateString) => {
        const parts = dateString.split("/").map(Number);
        if (parts.length !== 3) return dateString;
        const [day, month, year] = parts;
        const date = new Date(year, month - 1, day);

        return new Intl.DateTimeFormat("it-IT", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
        }).format(date);
    };

    const handleClick = (event) => setAnchorEl(event.currentTarget);
    const handleClose = () => setAnchorEl(null);

    const handleSelectSort = (type) => {
        setSortType(type);
        handleClose();
    };

    const getFilterLabel = () => {
        switch (sortType) {
            case "chronological":
                return "Ordine cronologico";
            case "peopleAsc":
                return "Data con meno persone";
            case "peopleDesc":
                return "Data con più persone";
            default:
                return "Nessun filtro";
        }
    };

    const sortedDates = Object.keys(groupedData).sort((a, b) => {
        if (sortType === "chronological") {
            const [dayA, monthA, yearA] = a.split("/").map(Number);
            const [dayB, monthB, yearB] = b.split("/").map(Number);
            return (
                new Date(yearA, monthA - 1, dayA) - new Date(yearB, monthB - 1, dayB)
            );
        } else if (sortType === "peopleAsc") {
            return (groupedData[a]?.length || 0) - (groupedData[b]?.length || 0);
        } else if (sortType === "peopleDesc") {
            return (groupedData[b]?.length || 0) - (groupedData[a]?.length || 0);
        }
        return 0;
    });

    return (
        <Box
            sx={{
                minHeight: "100vh",
                backgroundColor: "#f8fafc",
                overflowX: "hidden",
                display: "flex",
                flexDirection: "column",
            }}
        >
            {/* 🔹 Barra superiore fissa */}
            <AppBar
                position="fixed"
                elevation={2}
                sx={{
                    backgroundColor: "rgba(215,255,186,0.5)",
                    backdropFilter: "blur(8px)",
                    color: "primary.main",
                    zIndex: 1201,
                    width: "100%",
                }}
            >
                <Toolbar
                    sx={{
                        display: "flex",
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        width: "95%",
                        px: isMobile ? 1.5 : 3,
                        py: isMobile ? 0.5 : 1,
                    }}
                >
                    <Typography
                        variant={isMobile ? "h6" : "h5"}
                        fontWeight="bold"
                        color="primary"
                        sx={{
                            flex: 1,
                            textAlign: "left",
                            mb: isMobile ? 1 : 0,
                            fontSize: isMobile ? "1rem" : "1.5rem"
                        }}
                    >
                        Disponibilità date <br />
                        <strong>Associazione Ohel</strong>
                    </Typography>

                    {/* 🔸 Filtro */}
                    <Box
                        sx={{
                            display: "flex",
                            flexDirection: isMobile ? "column" : "row",
                            alignItems: "center",
                            flexWrap: "wrap",
                            mt: isMobile ? 0.5 : 0,
                        }}
                    >
                        <Box sx={{ display: "flex", flexDirection: "row", alignItems: "center" }}>
                            <IconButton
                                onClick={handleClick}
                                color="primary"
                                size={isMobile ? "small" : "medium"}
                            >
                                <FilterListIcon />
                            </IconButton>
                            <Typography
                                variant={isMobile ? "body2" : "body1"}
                                sx={{
                                    cursor: "pointer",
                                    mr: 1,
                                    fontWeight: 500,
                                }}
                                onClick={handleClick}
                            >
                                Filtra
                            </Typography>
                        </Box>

                        <Chip
                            label={getFilterLabel()}
                            onClick={handleClick}
                            color="primary"
                            variant="outlined"
                            size={isMobile ? "small" : "medium"}
                            sx={{ ml: 1 }}
                        />

                        <Menu
                            anchorEl={anchorEl}
                            open={Boolean(anchorEl)}
                            onClose={handleClose}
                        >
                            <MenuItem onClick={() => handleSelectSort("chronological")}>
                                Ordine cronologico
                            </MenuItem>
                            <MenuItem onClick={() => handleSelectSort("peopleDesc")}>
                                Data con più persone
                            </MenuItem>
                            <MenuItem onClick={() => handleSelectSort("peopleAsc")}>
                                Data con meno persone
                            </MenuItem>
                        </Menu>
                    </Box>
                </Toolbar>
            </AppBar>

            {/* 🔹 Spazio per evitare sovrapposizione sotto l’AppBar */}
            <Toolbar />

            {/* 🔹 Contenuto principale */}
            <Container
                maxWidth="md"
                sx={{
                    py: isMobile ? 4 : 4,
                    flexGrow: 1, // fa sì che il footer resti in fondo
                }}
            >
                {loading ? (
                    <Box sx={{ display: "flex", justifyContent: "center", mt: 8 }}>
                        <CircularProgress color="primary" />
                    </Box>
                ) : sortedDates.length === 0 ? (
                    <Typography align="center" color="text.secondary">
                        Nessuna disponibilità trovata.
                    </Typography>
                ) : (
                    sortedDates.map((date, index) => {
                        const people = groupedData[date];
                        const count = people.length;

                        return (
                            <Fade in timeout={400 + index * 150} key={date}>
                                <Card
                                    sx={{
                                        mb: 3,
                                        borderRadius: 3,
                                        boxShadow: 3,
                                        "&:hover": {
                                            transform: !isMobile ? "scale(1.02)" : "none",
                                            transition: "transform 0.2s",
                                        },
                                    }}
                                >
                                    <CardContent>
                                        <Box
                                            display="flex"
                                            alignItems="center"
                                            justifyContent="space-between" // <-- spinge il conteggio all'estrema destra
                                            mb={1.5}
                                            flexWrap={isMobile ? "wrap" : "nowrap"}
                                        >
                                            {/* Icona + data */}
                                            <Box display="flex" alignItems="center">
                                                <CalendarMonthIcon
                                                    color="primary"
                                                    sx={{ mr: 1, fontSize: isMobile ? "1.1rem" : "1.3rem" }}
                                                />
                                                <Typography
                                                    variant={isMobile ? "subtitle1" : "h6"}
                                                    fontWeight="bold"
                                                    color="primary"
                                                    sx={{ fontSize: isMobile ? "1.1rem" : "1.3rem" }}
                                                >
                                                    {formatItalianDate(date)}
                                                </Typography>
                                            </Box>

                                            {/* Numero persone */}
                                            <Typography
                                                variant="body2"
                                                color="text.secondary"
                                                sx={{ fontWeight: 500, mt: isMobile ? 0.5 : 0 }}
                                            >
                                                {count} {count === 1 ? "persona" : "persone"}
                                            </Typography>
                                        </Box>

                                        {/* Lista persone */}
                                        <List dense>
                                            {people.map((name, i) => (
                                                <ListItem key={i} disableGutters>
                                                    <ListItemIcon sx={{ minWidth: 30 }}>
                                                        <PersonIcon
                                                            color="action"
                                                            sx={{ fontSize: isMobile ? "1rem" : "1.2rem" }}
                                                        />
                                                    </ListItemIcon>
                                                    <ListItemText
                                                        primaryTypographyProps={{
                                                            fontSize: isMobile ? "0.9rem" : "1rem",
                                                        }}
                                                        primary={name}
                                                    />
                                                </ListItem>
                                            ))}
                                        </List>
                                    </CardContent>
                                </Card>
                            </Fade>
                        );
                    })
                )}
            </Container>

            {/* 🔹 Footer */}
            <Box
                component="footer"
                sx={{
                    textAlign: "center",
                    py: 2,
                    backgroundColor: "rgba(215,255,186,0.5)",
                    mt: "auto",
                    borderTop: "1px solid rgba(0,0,0,0.1)",
                }}
            >
                <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ fontSize: isMobile ? "0.8rem" : "0.9rem" }}
                >
                    © 2025 <strong>DigitalCreations</strong>
                </Typography>
            </Box>
        </Box>
    );
};

export default GoogleSheetReader;
