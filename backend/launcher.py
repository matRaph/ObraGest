"""
Launcher do ObraGest para Windows.

Fluxo:
  1. Solicita elevação UAC (melhor chance de gravar o hosts / porta 80)
  2. Tenta mapear obragest.com.br → 127.0.0.1 no hosts
  3. Se o hosts falhar, usa http://localhost:8080 (nunca abre o site público)
  4. Migra o banco, sobe o waitress e abre o navegador
  5. Ícone na bandeja para encerrar
"""

from __future__ import annotations

import ctypes
import os
import socket
import sys
import threading
import time
import urllib.request
import webbrowser
from pathlib import Path


APP_NAME = "ObraGest"
HOSTS_DOMAIN = "obragest.com.br"
HOSTS_ENTRY = f"127.0.0.1 {HOSTS_DOMAIN}"
HOSTS_FILE = r"C:\Windows\System32\drivers\etc\hosts"

# Definidos em resolve_runtime_mode()
APP_URL = f"http://{HOSTS_DOMAIN}"
SERVER_PORT = 80
USING_HOSTS = False


def is_admin() -> bool:
    try:
        return bool(ctypes.windll.shell32.IsUserAnAdmin())
    except Exception:
        return False


def request_admin_elevation() -> None:
    """Re-lança com UAC. Se o usuário recusar, segue sem admin (modo localhost)."""
    script = sys.executable if getattr(sys, "frozen", False) else os.path.abspath(__file__)
    rc = ctypes.windll.shell32.ShellExecuteW(None, "runas", script, "", None, 1)
    # rc > 32 = sucesso ao lançar o processo elevado
    if rc > 32:
        sys.exit(0)
    print("[UAC] Elevação recusada — continuando em modo localhost (sem hosts).")


def _port_free(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            sock.bind(("127.0.0.1", port))
            return True
        except OSError:
            return False


def configure_hosts() -> bool:
    """Adiciona obragest.com.br → 127.0.0.1. Retorna True se o domínio aponta para local."""
    try:
        path = Path(HOSTS_FILE)
        # Remove atributo somente-leitura se existir
        try:
            import stat

            if path.exists() and not os.access(path, os.W_OK):
                path.chmod(stat.S_IWRITE | stat.S_IREAD)
        except Exception:
            pass

        text = path.read_text(encoding="utf-8", errors="ignore")
        if HOSTS_DOMAIN not in text:
            with open(HOSTS_FILE, "a", encoding="utf-8") as f:
                f.write(f"\n{HOSTS_ENTRY}\n")
            print(f"[hosts] Entrada '{HOSTS_DOMAIN}' adicionada.")
        else:
            # Garante linha 127.0.0.1 (evita entrada antiga apontando para outro IP)
            lines = text.splitlines()
            updated = []
            changed = False
            for line in lines:
                stripped = line.strip()
                if stripped.startswith("#") or HOSTS_DOMAIN not in stripped:
                    updated.append(line)
                    continue
                if stripped.startswith("127.0.0.1") and HOSTS_DOMAIN in stripped:
                    updated.append(line)
                else:
                    updated.append(HOSTS_ENTRY)
                    changed = True
            if changed:
                path.write_text("\n".join(updated) + "\n", encoding="utf-8")
                print(f"[hosts] Entrada '{HOSTS_DOMAIN}' corrigida para 127.0.0.1.")
            else:
                print(f"[hosts] Entrada '{HOSTS_DOMAIN}' já configurada.")
        return True
    except Exception as e:
        print(f"[hosts] Aviso: não foi possível configurar — {e}")
        return False


def resolve_runtime_mode(hosts_ok: bool) -> None:
    """Define URL/porta: hosts+80 se possível; senão localhost:8080."""
    global APP_URL, SERVER_PORT, USING_HOSTS

    if hosts_ok and is_admin() and _port_free(80):
        USING_HOSTS = True
        SERVER_PORT = 80
        APP_URL = f"http://{HOSTS_DOMAIN}"
        print(f"[modo] Produção local — {APP_URL}")
        return

    USING_HOSTS = False
    SERVER_PORT = 8080
    APP_URL = "http://localhost:8080"
    if not hosts_ok:
        print(
            "[modo] Fallback — hosts indisponível. "
            "Abrindo localhost (evita o site público na internet)."
        )
    elif not is_admin():
        print("[modo] Fallback — sem administrador; usando porta 8080.")
    else:
        print("[modo] Fallback — porta 80 ocupada; usando 8080.")
    print(f"[modo] Acesse: {APP_URL}")


def get_bundle_dir() -> Path:
    if getattr(sys, "frozen", False):
        return Path(sys._MEIPASS)
    return Path(__file__).resolve().parent


def configure_environment() -> None:
    base_dir = get_bundle_dir()
    data_dir = Path.home() / "ObraGest" / "data"
    data_dir.mkdir(parents=True, exist_ok=True)

    os.environ["DJANGO_SETTINGS_MODULE"] = "obragest.settings"
    os.environ["OBRA_GEST_DATA_DIR"] = str(data_dir)
    os.environ["DEBUG"] = "false"
    os.environ["OBRAGEST_LAUNCHER"] = "1"
    os.environ["OAUTHLIB_INSECURE_TRANSPORT"] = "1"
    if "SECRET_KEY" not in os.environ:
        os.environ["SECRET_KEY"] = "obragest-local-key-troque-em-producao-xYz9@2!"

    if USING_HOSTS:
        origin = f"http://{HOSTS_DOMAIN}"
        os.environ["ALLOWED_HOSTS"] = f"{HOSTS_DOMAIN},localhost,127.0.0.1"
        os.environ["CORS_ALLOWED_ORIGINS"] = origin
        os.environ["FRONTEND_URL"] = origin
        os.environ["GOOGLE_DRIVE_REDIRECT_URI"] = f"{origin}/google/callback/"
    else:
        origin = "http://localhost:8080"
        os.environ["ALLOWED_HOSTS"] = "localhost,127.0.0.1"
        os.environ["CORS_ALLOWED_ORIGINS"] = origin
        os.environ["FRONTEND_URL"] = origin
        os.environ["GOOGLE_DRIVE_REDIRECT_URI"] = f"{origin}/google/callback/"

    bundled_secrets = base_dir / "google_client_secret.json"
    if bundled_secrets.is_file():
        os.environ["GOOGLE_OAUTH_CLIENT_SECRETS"] = str(bundled_secrets)

    sys.path.insert(0, str(base_dir))


def run_django_setup() -> None:
    import django

    django.setup()

    from django.conf import settings
    from django.core.management import call_command

    frontend_dist = settings.FRONTEND_DIST
    if not frontend_dist.exists() or not (frontend_dist / "index.html").is_file():
        print(
            f"[AVISO] Frontend não encontrado em {frontend_dist}. "
            "Recompile o build."
        )
    else:
        print(f"Frontend OK: {frontend_dist}")

    secrets = Path(settings.GOOGLE_OAUTH_CLIENT_SECRETS)
    if secrets.is_file():
        print(f"Google OAuth OK: {secrets}")
    else:
        print(
            f"[AVISO] Google OAuth ausente ({secrets}). "
            "Backup no Drive ficará indisponível neste build."
        )

    print("Verificando banco de dados...")
    call_command("migrate", "--noinput", verbosity=0)
    call_command("seed_categories", verbosity=0)
    print("Banco de dados pronto.")


def start_server() -> None:
    from waitress import serve
    from obragest.wsgi import application

    print(f"Servidor iniciado — porta {SERVER_PORT}.")
    serve(application, host="127.0.0.1", port=SERVER_PORT, threads=4)


def wait_until_ready(timeout: float = 60.0) -> bool:
    """Espera o /api/health/ em vez de sleep fixo (abre o browser quando pronto)."""
    url = f"http://127.0.0.1:{SERVER_PORT}/api/health/"
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=1) as resp:
                if 200 <= resp.status < 300:
                    return True
        except Exception:
            pass
        time.sleep(0.25)
    return False


def create_tray_icon():
    from PIL import Image, ImageDraw

    img = Image.new("RGB", (64, 64), color="#1e40af")
    draw = ImageDraw.Draw(img)
    draw.ellipse([8, 8, 56, 56], outline="white", width=6)
    draw.ellipse([20, 20, 44, 44], fill="white")
    return img


def open_app() -> None:
    webbrowser.open(APP_URL)


def run_with_tray() -> None:
    import pystray

    server_thread = threading.Thread(target=start_server, daemon=True)
    server_thread.start()

    print("Aguardando servidor...")
    if wait_until_ready():
        print("Abrindo navegador...")
        open_app()
    else:
        print("[AVISO] Servidor demorou para responder; abrindo navegador mesmo assim.")
        open_app()

    def on_open(icon, item):
        open_app()

    def on_quit(icon, item):
        icon.stop()
        os._exit(0)

    icon = pystray.Icon(
        APP_NAME,
        create_tray_icon(),
        APP_NAME,
        menu=pystray.Menu(
            pystray.MenuItem("Abrir ObraGest", on_open, default=True),
            pystray.MenuItem("Encerrar", on_quit),
        ),
    )

    print(f"\nObraGest rodando em {APP_URL}")
    print("Clique com o botão direito no ícone da bandeja do sistema para encerrar.")
    icon.run()


def run_console_fallback() -> None:
    server_thread = threading.Thread(target=start_server, daemon=True)
    server_thread.start()

    print("\n" + "=" * 50)
    print(f"  {APP_NAME} iniciado com sucesso!")
    print(f"  Acesse: {APP_URL}")
    print("  Feche esta janela para encerrar o sistema.")
    print("=" * 50 + "\n")

    wait_until_ready()
    open_app()

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        pass


def main() -> None:
    # Tenta admin (hosts / porta 80). Se recusar UAC, continua em localhost:8080.
    if not is_admin():
        request_admin_elevation()
        # Se chegou aqui, UAC foi recusado — segue sem elevação

    print(f"=== {APP_NAME} ===")
    hosts_ok = configure_hosts()
    resolve_runtime_mode(hosts_ok)
    configure_environment()
    run_django_setup()

    try:
        run_with_tray()
    except ImportError:
        run_console_fallback()


if __name__ == "__main__":
    main()
