import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "./components/Home";
import GoogleSheetReader from "./components/GoogleSheetReader";
import NotFoundPage from "./components/NotFoundPage";
import Dashboard from "./components/Dashboard"; // Assicurati che il percorso sia corretto
import ProtectedRoute from "./components/ProtectedRoute";
import SurveyEdit from "./components/SurveyEdit";
import SurveyVote from "./components/SurveyVote"; // Il "buttafuori" delle rotte

function App() {
    return (
        <Router>
            <div>
                <Routes>
                    {/* La Home diventa la pagina iniziale predefinita */}
                    <Route path="/" element={<Home />} />

                    {/* Spostiamo la visualizzazione dei fogli su una rotta dedicata */}
                    <Route path="/disponibilita" element={<GoogleSheetReader />} />

                    {/* Rotta Protetta per la Dashboard */}
                    <Route
                        path="/dashboard"
                        element={
                            <ProtectedRoute>
                                <Dashboard />
                            </ProtectedRoute>
                        }
                    />

                    <Route
                        path="/surveys/edit"
                        element={
                            <ProtectedRoute>
                                <SurveyEdit />
                            </ProtectedRoute>
                        }
                    />

                    <Route
                        path="/surveys/:id"
                        element={
                            <ProtectedRoute>
                                <SurveyVote />
                            </ProtectedRoute>
                        }
                    />

                    {/* Gestione 404 per qualsiasi altra rotta errata */}
                    <Route path="*" element={<NotFoundPage />} />
                </Routes>
            </div>
        </Router>
    );
}

export default App;