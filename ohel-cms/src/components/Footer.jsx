import React from "react";

function Footer() {
    return (
        <footer style={styles.footer}>
            <p style={styles.footerText}>© 2026 DigitalCreations</p>
        </footer>
    );
}

const styles = {
    footer: {
        marginTop: "30px",
        textAlign: "center",
        width: "100%",
    },
    footerText: {
        fontSize: "0.78rem",
        color: "#83a697",
        margin: 0,
        fontFamily: "system-ui, -apple-system, sans-serif",
    },
};

export default Footer;