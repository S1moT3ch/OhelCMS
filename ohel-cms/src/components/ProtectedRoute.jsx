import React from "react";
import { Navigate } from "react-router-dom";

function ProtectedRoute({ children }) {
    const authToken = localStorage.getItem("authToken");
    const userProfile = localStorage.getItem("userProfile");

    // Se manca il token o il profilo dell'associazione, reindirizza alla Home
    if (!authToken || !userProfile) {
        return <Navigate to="/" replace />;
    }

    // Se l'utente è autenticato, mostra la pagina richiesta
    return children;
}

export default ProtectedRoute;