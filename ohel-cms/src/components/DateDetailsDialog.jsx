import React from "react";
import {
    Dialog,
    DialogTitle,
    DialogContent,
    Box,
    Typography,
    List,
    ListItem,
    ListItemIcon,
    ListItemText,
    DialogActions,
    Button,
    useTheme,
    useMediaQuery
} from "@mui/material";
import PersonIcon from "@mui/icons-material/Person";
import RestaurantIcon from "@mui/icons-material/Restaurant";

const DateDetailsDialog = ({ open, onClose, dateLabel, peopleWithResponses }) => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

    // Opzioni giornaliere standard
    const dayOptions = [
        "una parte della giornata",
        "anche a pranzo",
        "anche a cena",
        "senza cena",
        "con posti auto",
        "ho bisogno di passaggio"
    ];

    const options = {};
    const intolerances = {};

    // Separazione: opzioni vs intolleranze
    Object.entries(peopleWithResponses).forEach(([key, people]) => {
        const normalized = key.trim().toLowerCase();
        const isDayOption = dayOptions.some((opt) => normalized.includes(opt));
        if (isDayOption) {
            options[key] = people;
        } else if (people && people.length > 0) {
            intolerances[key] = people;
        }
    });

    // Persone coinvolte nella data corrente
    const peopleInDate = new Set(
        Object.values(options)
            .flat()
            .map((p) => p.name)
    );

    // Filtriamo le intolleranze solo per queste persone
    const intolerancesFiltered = {};
    Object.entries(intolerances).forEach(([intol, people]) => {
        const involved = people.filter((p) => peopleInDate.has(p.name));
        if (involved.length > 0) intolerancesFiltered[intol] = involved;
    });

    // Funzione per disegnare box
    const renderPeopleBox = (title, people, isIntolerance = false) => (
        <Box
            key={title}
            flex={1}
            minWidth={180}
            border={1}
            borderColor="grey.300"
            borderRadius={3}
            p={1.5}
            sx={{
                boxShadow: 2,
                backgroundColor: isIntolerance
                    ? "rgba(255,230,230,0.45)"
                    : "rgba(255,255,255,0)",
                "&:hover": {
                    transform: !isMobile ? "scale(1.02)" : "none",
                    transition: "transform 0.2s",
                    boxShadow: 4
                }
            }}
        >
            <Typography
                fontWeight="bold"
                mb={1}
                color={isIntolerance ? "error.main" : "primary.main"}
                sx={{ fontSize: isMobile ? "1.3rem" : "1.05rem" }}
            >
                {title} ({people.length} {people.length === 1 ? "persona" : "persone"})
            </Typography>
            <List dense>
                {people.map((p, i) => (
                    <ListItem key={i} disableGutters>
                        <ListItemIcon sx={{ minWidth: 30 }}>
                            {isIntolerance ? (
                                <RestaurantIcon
                                    sx={{
                                        fontSize: isMobile ? "1rem" : "1.2rem",
                                        color: theme.palette.error.main
                                    }}
                                />
                            ) : (
                                <PersonIcon
                                    sx={{
                                        fontSize: isMobile ? "1.3rem" : "1.2rem",
                                        color: "#000000",
                                    }}
                                />
                            )}
                        </ListItemIcon>
                        <ListItemText
                            primaryTypographyProps={{
                                fontSize: isMobile ? "1.2rem" : "1rem"
                            }}
                            primary={p.name}
                        />
                    </ListItem>
                ))}
            </List>
        </Box>
    );

    return (
        <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
            <DialogTitle
                sx={{
                    fontWeight: "bold",
                    color: "primary.main",
                    backgroundColor: "rgba(215,255,186,0.4)"
                }}
            >
                Dettagli data
                <Typography fontSize="0.95rem">{dateLabel}</Typography>
            </DialogTitle>

            <DialogContent dividers sx={{ py: 3 }}>
                {/* Opzioni della giornata */}
                {Object.keys(options).length > 0 && (
                    <Box display="flex" flexWrap="wrap" gap={2} mb={3}>
                        {Object.entries(options).map(([option, people]) =>
                            renderPeopleBox(option, people, false)
                        )}
                    </Box>
                )}

                {/* Divider */}
                {Object.keys(intolerancesFiltered).length > 0 && (
                    <Box my={3} display="flex" alignItems="center">
                        <Box flexGrow={1} height={1} bgcolor="grey.300" />
                        <Typography
                            variant="subtitle2"
                            sx={{
                                mx: 2,
                                color: "text.secondary",
                                fontWeight: 600,
                                fontSize: "0.93rem",
                                letterSpacing: 0.5,
                            }}
                        >
                            Intolleranze / Esigenze alimentari
                        </Typography>
                        <Box flexGrow={1} height={1} bgcolor="grey.300" />
                    </Box>
                )}

                {/* Intolleranze filtrate */}
                {Object.keys(intolerancesFiltered).length > 0 && (
                    <Box display="flex" flexWrap="wrap" gap={2}>
                        {Object.entries(intolerancesFiltered).map(([intol, people]) =>
                            renderPeopleBox(intol, people, true)
                        )}
                    </Box>
                )}
            </DialogContent>

            <DialogActions
                sx={{
                    backgroundColor: "rgba(215,255,186,0.2)",
                    borderTop: "1px solid rgba(0,0,0,0.1)"
                }}
            >
                <Button
                    onClick={onClose}
                    color="primary"
                    variant="contained"
                    size={isMobile ? "small" : "medium"}
                    sx={{ borderRadius: 2, fontWeight: 600 }}
                >
                    Chiudi
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default DateDetailsDialog;
