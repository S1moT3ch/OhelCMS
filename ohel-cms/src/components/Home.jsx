import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { GoogleLogin } from "@react-oauth/google";
import CONFIG from "../config/config";
import HeaderCompact from "./HeaderCompact";
import Footer from "./Footer";

function Home() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [showRegisterForm, setShowRegisterForm] = useState(false);
    const [isLoggedIn, setIsLoggedIn] = useState(false);

    const [formData, setFormData] = useState({
        idGoogle: "",
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

    const handleLoginSuccess = async (credentialResponse) => {
        setLoading(true);
        const idToken = credentialResponse.credential;
        localStorage.setItem("authToken", idToken);

        try {
            const response = await fetch(URL_APPS_SCRIPT, {
                method: "POST",
                mode: "cors",
                body: JSON.stringify({ action: "LOGIN", token: idToken }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`[ERRORE DI RETE BROWSER] Stato: ${response.status} - ${response.statusText}`);
                console.error("[DETTAGLIO ERRORE SERVER]:", errorText);
                alert(`Errore del server (${response.status}). Controlla la console degli sviluppatori.`);
                return;
            }

            const data = await response.json();

            if (data.status === "success") {
                if (data.exists) {
                    localStorage.setItem("userProfile", JSON.stringify(data.user));
                    navigate("/dashboard");
                } else {
                    setFormData({
                        idGoogle: data.googleData.idGoogle,
                        nome: data.googleData.nome,
                        cognome: data.googleData.cognome,
                        email: data.googleData.email,
                        picture: data.googleData.picture
                    });
                    setShowRegisterForm(true);
                }
            } else {
                console.warn("[LOG APPLICATIVO BACKEND]:", data.message);
                alert("Errore durante l'autenticazione: " + data.message);
            }
        } catch (err) {
            console.error("[CRASH COMPLETO FETCH/CORS]:", err);
            alert("Impossibile connettersi al server del backend. Verifica blocchi CORS o URL errati.");
        } finally {
            setLoading(false);
        }
    };

    const handleLoginError = () => {
        console.error("Accesso con Google fallito.");
        alert("Si è verificato un errore durante il login. Controlla la connessione.");
    };

    const handleRegisterSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        const idToken = localStorage.getItem("authToken");

        try {
            const response = await fetch(URL_APPS_SCRIPT, {
                method: "POST",
                mode: "cors",
                body: JSON.stringify({
                    action: "REGISTER",
                    token: idToken,
                    payload: formData
                }),
            });
            const data = await response.json();

            if (data.status === "success") {
                localStorage.setItem("userProfile", JSON.stringify(formData));
                setShowRegisterForm(false);
                navigate("/dashboard");
            } else {
                alert("Errore: " + data.message);
            }
        } catch (err) {
            alert("Errore di rete durante la registrazione.");
        } finally {
            setLoading(false);
        }
    };

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

                {loading && <div style={styles.loadingSpinner}>Elaborazione in corso...</div>}

                {!showRegisterForm ? (
                    <main style={styles.menu}>
                        <button
                            style={{ ...styles.button, ...styles.primaryButton }}
                            onClick={() => navigate("/disponibilita")}
                        >
                            Visualizza le presenze
                        </button>

                        <div style={styles.divider}>
                            <span style={styles.dividerText}>oppure gestisci</span>
                        </div>

                        <div style={styles.loginContainer}>
                            {isLoggedIn ? (
                                /* Interfaccia se l'utente ha già effettuato l'accesso in precedenza */
                                <button
                                    style={{ ...styles.button, ...styles.secondaryButton }}
                                    onClick={() => navigate("/dashboard")}
                                >
                                    Vai alla tua Area Riservata →
                                </button>
                            ) : (
                                /* Mostra il login nativo di Google solo se non è loggato */
                                <GoogleLogin
                                    onSuccess={handleLoginSuccess}
                                    onError={handleLoginError}
                                    theme="outline"
                                    size="large"
                                    shape="pill"
                                    locale="it"
                                    width="100%"
                                />
                            )}
                        </div>
                    </main>
                ) : (
                    <form onSubmit={handleRegisterSubmit} style={styles.formSection}>
                        <h2 style={styles.formTitle}>Completa Iscrizione</h2>
                        <p style={styles.formSubtitle}>Conferma i tuoi dati istituzionali per accedere.</p>

                        <div style={styles.inputGroup}>
                            <label style={styles.label}>Nome</label>
                            <input
                                type="text"
                                required
                                value={formData.nome}
                                onChange={(e) => setFormData({...formData, nome: e.target.value})}
                                style={styles.input}
                            />
                        </div>

                        <div style={styles.inputGroup}>
                            <label style={styles.label}>Cognome</label>
                            <input
                                type="text"
                                required
                                value={formData.cognome}
                                onChange={(e) => setFormData({...formData, cognome: e.target.value})}
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
    },
    loginContainer: {
        width: "100%",
        display: "flex",
        justifyContent: "center",
    },
    divider: {
        width: "100%",
        display: "flex",
        alignItems: "center",
        textAlign: "center",
        margin: "8px 0",
    },
    dividerText: {
        fontSize: "0.85rem",
        color: "#83a697",
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        margin: "0 auto",
        backgroundColor: "#f4f7f5",
        padding: "0 12px",
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