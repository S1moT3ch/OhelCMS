import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useGoogleLogin } from "@react-oauth/google";
import CONFIG from "../config/config";
import HeaderCompact from "./HeaderCompact";
import Footer from "./Footer";
import LoadingScreen from "./LoadingScreen";
import MessageDialog from "./MessageDialog";

function Home() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [showRegisterForm, setShowRegisterForm] = useState(false);
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [dialog, setDialog] = useState({ open: false, title: "", message: "", severity: "info" });

    const showDialog = (title, message, severity = "info") => {
        setDialog({ open: true, title, message, severity });
    };

    const [formData, setFormData] = useState({
        nome: "",
        cognome: "",
        email: "",
        picture: ""
    });

    const { URL_APPS_SCRIPT } = CONFIG;

    // Controlla se l'utente ha già una sessione attiva al caricamento della pagina
    useEffect(() => {
        const token = localStorage.getItem("authToken");
        const profile = localStorage.getItem("userProfile");
        if (token && profile) {
            setIsLoggedIn(true);
        }
    }, []);

    const processLoginWithToken = async (token) => {
        setLoading(true);
        localStorage.setItem("authToken", token);

        try {
            const response = await fetch(URL_APPS_SCRIPT, {
                method: "POST",
                mode: "cors",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "LOGIN", token: token }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`[ERRORE DI RETE BROWSER] Stato: ${response.status} - ${response.statusText}`);
                console.error("[DETTAGLIO ERRORE SERVER]:", errorText);
                showDialog("Errore Server", `Errore del server (${response.status}). Riprova più tardi.`, "error");
                return;
            }

            const data = await response.json();

            if (data.status === "success") {
                if (data.exists) {
                    localStorage.setItem("userProfile", JSON.stringify(data.user));
                    navigate("/dashboard");
                } else {
                    setFormData({
                        nome: data.googleData?.nome || "",
                        cognome: data.googleData?.cognome || "",
                        email: data.googleData?.email || "",
                        picture: data.googleData?.picture || ""
                    });
                    setShowRegisterForm(true);
                }
            } else {
                console.warn("[LOG APPLICATIVO BACKEND]:", data.message);
                showDialog("Autenticazione Fallita", data.message || "Impossibile accedere.", "error");
            }
        } catch (err) {
            console.error("[CRASH COMPLETO FETCH/CORS]:", err);
            showDialog("Errore Connessione", "Impossibile connettersi al server del backend.", "error");
        } finally {
            setLoading(false);
        }
    };

    const loginWithGoogle = useGoogleLogin({
        onSuccess: async (tokenResponse) => {
            await processLoginWithToken(tokenResponse.access_token);
        },
        onError: () => {
            console.error("Accesso con Google fallito.");
            showDialog("Accesso Fallito", "Si è verificato un errore durante il login con Google.", "warning");
        }
    });

    const handleRegisterSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        const token = localStorage.getItem("authToken");

        try {
            const response = await fetch(URL_APPS_SCRIPT, {
                method: "POST",
                mode: "cors",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "REGISTER",
                    token: token,
                    payload: formData
                }),
            });
            const data = await response.json();

            if (data.status === "success") {
                const userObj = data.user || formData;
                localStorage.setItem("userProfile", JSON.stringify(userObj));
                setShowRegisterForm(false);
                navigate("/dashboard");
            } else {
                showDialog("Registrazione Non Riuscita", data.message, "error");
            }
        } catch (err) {
            showDialog("Errore di Rete", "Errore di rete durante la registrazione.", "error");
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return <LoadingScreen message="Autenticazione in corso..." color="#2e5b43" fullScreen={true} />;
    }

    return (
        <div style={{
            ...styles.container,
            paddingTop: showRegisterForm ? "84px" : "40px"
        }}>
            <div style={styles.contentWrapper}>

                {/* HEADER DINAMICO */}
                {!showRegisterForm ? (
                    <header style={styles.headerFull}>
                        <div style={styles.logoContainerFull}>
                            <img
                                src="/logo_Ohel.png"
                                alt="Logo Associazione Ohel"
                                style={styles.logoFull}
                            />
                        </div>
                        <h1 style={styles.titleFull}>Ohel CMS</h1>
                        <p style={styles.subtitleFull}>Tutta la vita associativa, in un click</p>
                    </header>
                ) : (
                    <HeaderCompact subtitle="Completamento iscrizione" />
                )}

                {!showRegisterForm ? (
                    <main style={styles.menu}>
                        {isLoggedIn ? (
                            /* Interfaccia se l'utente ha già effettuato l'accesso in precedenza */
                            <button
                                style={{
                                    ...styles.button,
                                    ...styles.primaryButton,
                                    width: "auto",
                                    minWidth: "210px",
                                    padding: "9px 18px",
                                    fontSize: "0.88rem",
                                    borderRadius: "10px"
                                }}
                                onClick={() => navigate("/dashboard")}
                            >
                                Vai alla tua Area Riservata →
                            </button>
                        ) : (
                            /* Tasto Accesso con Google integrato nello stile Ohel */
                            <button
                                type="button"
                                style={styles.googleLoginButton}
                                onClick={() => loginWithGoogle()}
                            >
                                <div style={styles.googleIconBadge}>
                                    <svg width="15" height="15" viewBox="0 0 24 24">
                                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                                    </svg>
                                </div>
                                <span style={styles.googleLoginText}>Accedi con Google</span>
                            </button>
                        )}
                    </main>
                ) : (
                    <form onSubmit={handleRegisterSubmit} style={styles.formSection}>
                        <h2 style={styles.formTitle}>Completa Iscrizione</h2>
                        <p style={styles.formSubtitle}>I tuoi dati verificati da Google per l'accesso.</p>

                        <div style={styles.inputGroup}>
                            <label style={styles.label}>Nome</label>
                            <input
                                type="text"
                                required
                                value={formData.nome}
                                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                                style={styles.input}
                            />
                        </div>

                        <div style={styles.inputGroup}>
                            <label style={styles.label}>Cognome</label>
                            <input
                                type="text"
                                required
                                value={formData.cognome}
                                onChange={(e) => setFormData({ ...formData, cognome: e.target.value })}
                                style={styles.input}
                            />
                        </div>

                        <div style={styles.inputGroup}>
                            <label style={styles.label}>Email (Verificata Google)</label>
                            <input
                                type="text"
                                disabled
                                value={formData.email}
                                style={{ ...styles.input, backgroundColor: "#e2e8f0", color: "#64748b", cursor: "not-allowed" }}
                            />
                        </div>

                        <button type="submit" style={{ ...styles.button, ...styles.primaryButton }}>
                            Registrati ed Accedi
                        </button>
                    </form>
                )}
            </div>

            <MessageDialog
                open={dialog.open}
                onClose={() => setDialog(prev => ({ ...prev, open: false }))}
                title={dialog.title}
                message={dialog.message}
                severity={dialog.severity}
            />

            <Footer />
        </div>
    );
}

const styles = {
    container: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "space-between",
        minHeight: "100vh",
        padding: "40px 24px 20px 24px",
        backgroundColor: "#f4f7f5",
        fontFamily: "system-ui, -apple-system, sans-serif",
        boxSizing: "border-box",
        transition: "padding 0.3s ease",
    },
    contentWrapper: {
        width: "100%",
        maxWidth: "360px",
        display: "flex",
        flexDirection: "column",
        marginTop: "auto",
        marginBottom: "auto",
    },
    headerFull: {
        textAlign: "center",
        marginBottom: "16px",
    },
    logoContainerFull: {
        display: "flex",
        justifyContent: "center",
        marginBottom: "20px",
    },
    logoFull: {
        width: "160px",
        height: "160px",
        objectFit: "contain",
        borderRadius: "28px",
        padding: "8px",
        backgroundColor: "#ffffff",
        boxShadow: "0 8px 24px rgba(46, 91, 67, 0.08)",
        border: "1px solid #e8f0ec",
    },
    titleFull: {
        fontSize: "2.2rem",
        color: "#1e382b",
        margin: "0 0 4px 0",
        fontWeight: "800",
        letterSpacing: "-0.03em",
    },
    subtitleFull: {
        fontSize: "1.05rem",
        color: "#3b634f",
        margin: 0,
        fontWeight: "500",
        fontStyle: "italic",
        lineHeight: "1.4",
        letterSpacing: "0.01em",
    },
    menu: {
        display: "flex",
        flexDirection: "column",
        gap: "16px",
        width: "100%",
        alignItems: "center",
        marginTop: "16px",
    },
    googleLoginButton: {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "10px",
        padding: "8px 18px",
        minWidth: "210px",
        maxWidth: "260px",
        backgroundColor: "#2e5b43",
        color: "#ffffff",
        border: "none",
        borderRadius: "10px",
        cursor: "pointer",
        boxShadow: "0 3px 10px rgba(46, 91, 67, 0.18)",
        transition: "all 0.2s ease",
        boxSizing: "border-box",
        fontFamily: "inherit",
    },
    googleIconBadge: {
        width: "22px",
        height: "22px",
        backgroundColor: "#ffffff",
        borderRadius: "50%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 1px 2px rgba(0, 0, 0, 0.12)",
        flexShrink: 0,
    },
    googleLoginText: {
        fontSize: "0.88rem",
        fontWeight: "600",
        letterSpacing: "0.01em",
        color: "#ffffff",
    },
    loadingSpinner: {
        color: "#2e5b43",
        fontWeight: "600",
        fontSize: "0.95rem",
        marginBottom: "20px",
        textAlign: "center",
    },
    formSection: {
        display: "flex",
        flexDirection: "column",
        width: "100%",
        textAlign: "left",
        backgroundColor: "#ffffff",
        padding: "24px",
        borderRadius: "20px",
        boxShadow: "0 4px 15px rgba(46, 91, 67, 0.04)",
        border: "1px solid #e1ebe5",
        boxSizing: "border-box",
    },
    formTitle: {
        fontSize: "1.2rem",
        margin: "0 0 4px 0",
        color: "#1e382b",
        fontWeight: "700",
    },
    formSubtitle: {
        fontSize: "0.85rem",
        color: "#52796f",
        margin: "0 0 20px 0",
        lineHeight: "1.3"
    },
    inputGroup: {
        marginBottom: "14px",
    },
    label: {
        display: "block",
        fontSize: "0.8rem",
        fontWeight: "600",
        color: "#406353",
        marginBottom: "6px",
        textTransform: "uppercase",
        letterSpacing: "0.025em",
    },
    input: {
        width: "100%",
        padding: "12px 14px",
        borderRadius: "12px",
        border: "1px solid #bad1c6",
        fontSize: "1rem",
        boxSizing: "border-box",
        color: "#1e382b",
        outline: "none",
        backgroundColor: "#ffffff",
    },
    button: {
        padding: "14px 16px",
        fontSize: "1rem",
        fontWeight: "700",
        borderRadius: "14px",
        border: "none",
        cursor: "pointer",
        transition: "all 0.2s ease",
        width: "100%",
        boxSizing: "border-box",
    },
    primaryButton: {
        backgroundColor: "#2e5b43",
        color: "#ffffff",
        boxShadow: "0 4px 14px rgba(46, 91, 67, 0.2)",
    },
    secondaryButton: {
        backgroundColor: "#ffffff",
        color: "#2e5b43",
        border: "1px solid #bad1c6",
        boxShadow: "0 2px 8px rgba(46, 91, 67, 0.04)",
    },
};

export default Home;