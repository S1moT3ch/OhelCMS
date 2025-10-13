import React from "react";
import { Box, Typography, Button } from "@mui/material";
import { useNavigate } from "react-router-dom";

const NotFoundPage = () => {
    const navigate = useNavigate();

    return (
        <Box
            sx={{
                minHeight: "100vh",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
                textAlign: "center",
                backgroundColor: "#f8fafc",
                px: 2,
            }}
        >
            <Typography variant="h1" color="primary" sx={{ fontSize: { xs: "4rem", sm: "6rem" }, fontWeight: "bold" }}>
                404
            </Typography>
            <Typography variant="h5" sx={{ mb: 2 }}>
                Pagina non trovata
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3, maxWidth: 400 }}>
                La pagina che stai cercando non esiste o è stata rimossa.
            </Typography>
            <Button
                variant="contained"
                color="primary"
                onClick={() => navigate("/")}
            >
                Torna alla Home
            </Button>
        </Box>
    );
};

export default NotFoundPage;
