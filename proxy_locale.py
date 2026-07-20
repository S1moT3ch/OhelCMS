import http.server
import http.client
import ssl
import os

# Configura l'IP locale del tuo PC e la porta che userà lo smartphone
HOST_IP = "0.0.0.0"  # Ascolta su tutte le interfacce di rete
PORTA_PROXY = 8443   # Lo smartphone punterà a https://192.168.1.145.nip.io:8443

# La porta dove sta girando il tuo server React
REACT_HOST = "localhost"
REACT_PORT = 3000

class ProxyHTTPRequestHandler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        self.proxy_request("GET")

    def do_POST(self):
        self.proxy_request("POST")

    def do_OPTIONS(self):
        # Gestione dei pre-flight CORS per le chiamate API
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.end_headers()

    def proxy_request(self, method):
        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length) if content_length else None

        # Parla con il server React locale
        conn = http.client.HTTPConnection(REACT_HOST, REACT_PORT)

        # Copia gli header originali...
        headers = {k: v for k, v in self.headers.items()}
        # ...ma sovrascrivi l'Host per evitare l'errore "Invalid Host header" di React
        headers["Host"] = f"{REACT_HOST}:{REACT_PORT}"

        try:
            conn.request(method, self.path, body, headers)
            res = conn.getresponse()

            # Rispondi allo smartphone
            self.send_response(res.status)
            for k, v in res.getheaders():
                # Rimuoviamo l'header Transfer-Encoding originale per evitare conflitti di pacchetti
                if k.lower() != 'transfer-encoding':
                    self.send_header(k, v)
            
            # Forza header CORS per sicurezza nei test
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(res.read())
        except Exception as e:
            self.send_response(500)
            self.end_headers()
            self.wfile.write(f"Proxy Error: {str(e)}".encode())
        finally:
            conn.close()

# Avvia il server HTTPS
httpd = http.server.HTTPServer((HOST_IP, PORTA_PROXY), ProxyHTTPRequestHandler)

# Rilevamento automatico della cartella dello script per i certificati
script_dir = os.path.dirname(os.path.abspath(__file__))
cert_path = os.path.join(script_dir, "server.pem")
key_path = os.path.join(script_dir, "server.key")

ssl_context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
ssl_context.load_cert_chain(certfile=cert_path, keyfile=key_path)

httpd.socket = ssl_context.wrap_socket(httpd.socket, server_side=True)

print(f"[Proxy Pronto] Connettiti dallo smartphone a: https://192.168.1.145.nip.io:{PORTA_PROXY}")
httpd.serve_forever()