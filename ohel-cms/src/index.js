import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
// 1. Importa il provider di Google
import { GoogleOAuthProvider } from '@react-oauth/google';
import CONFIG from "./config/config";

const { REACT_APP_GOOGLE_CLIENT_ID } = CONFIG;
// 2. Sostituisci questa stringa con il Client ID reale copiato dalla Google Cloud Console
const GOOGLE_CLIENT_ID = REACT_APP_GOOGLE_CLIENT_ID;

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
    <React.StrictMode>
        {/* 3. Avvolgi l'applicazione nel provider */}
        <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
            <App />
        </GoogleOAuthProvider>
    </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();