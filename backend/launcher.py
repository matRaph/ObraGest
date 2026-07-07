"""
Launcher do ObraGest para Windows.
Requer execução como Administrador (solicitado automaticamente via UAC).

O executável gerado pelo PyInstaller:
  1. Solicita elevação de administrador (UAC) se necessário
  2. Adiciona 'obragest.com.br' ao arquivo hosts do Windows
  3. Aplica migrações do banco de dados
  4. Inicia o servidor web com waitress
  5. Abre o navegador em http://obragest.com.br
  6. Exibe um ícone na bandeja do sistema para encerrar
"""

import os
import sys
import ctypes
import threading
import webbrowser
import time
from pathlib import Path


APP_NAME = "ObraGest"
APP_URL = "http://obragest.com.br"
HOSTS_ENTRY = "127.0.0.1 obragest.com.br"
HOSTS_FILE = r"C:\Windows\System32\drivers\etc\hosts"
SERVER_PORT = 80


# ── Utilitários de sistema ────────────────────────────────────────────────────

def is_admin() -> bool:
    try:
        return bool(ctypes.windll.shell32.IsUserAnAdmin())
    except Exception:
        return False


def request_admin_elevation() -> None:
    """Re-lança o processo com elevação UAC e encerra o atual."""
    script = sys.executable if getattr(sys, "frozen", False) else os.path.abspath(__file__)
    ctypes.windll.shell32.ShellExecuteW(None, "runas", script, "", None, 1)
    sys.exit(0)


# ── Configuração do hosts ─────────────────────────────────────────────────────

def configure_hosts() -> None:
    """Adiciona a entrada obragest.com.br ao hosts se ainda não existir."""
    try:
        text = Path(HOSTS_FILE).read_text(encoding="utf-8")
        if "obragest.com.br" not in text:
            with open(HOSTS_FILE, "a", encoding="utf-8") as f:
                f.write(f"\n{HOSTS_ENTRY}\n")
            print("[hosts] Entrada 'obragest.com.br' adicionada.")
        else:
            print("[hosts] Entrada 'obragest.com.br' já configurada.")
    except Exception as e:
        print(f"[hosts] Aviso: não foi possível configurar — {e}")


# ── Configuração do ambiente Django ──────────────────────────────────────────

def get_bundle_dir() -> Path:
    """Retorna o diretório base, seja em desenvolvimento ou no bundle PyInstaller."""
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
    os.environ["ALLOWED_HOSTS"] = "obragest.com.br,localhost,127.0.0.1"
    os.environ["CORS_ALLOWED_ORIGINS"] = "http://obragest.com.br"
    os.environ["FRONTEND_URL"] = "http://obragest.com.br"
    os.environ["GOOGLE_DRIVE_REDIRECT_URI"] = "http://obragest.com.br/google/callback/"
    os.environ["OBRAGEST_LAUNCHER"] = "1"
    if "SECRET_KEY" not in os.environ:
        os.environ["SECRET_KEY"] = "obragest-local-key-troque-em-producao-xYz9@2!"

    sys.path.insert(0, str(base_dir))


def run_django_setup() -> None:
    import django
    django.setup()

    from django.core.management import call_command
    print("Verificando banco de dados...")
    call_command("migrate", "--noinput", verbosity=0)
    call_command("seed_categories", verbosity=0)
    print("Banco de dados pronto.")


# ── Servidor web ──────────────────────────────────────────────────────────────

def start_server() -> None:
    from waitress import serve
    from obragest.wsgi import application
    print(f"Servidor iniciado — porta {SERVER_PORT}.")
    serve(application, host="127.0.0.1", port=SERVER_PORT, threads=4)


# ── Ícone na bandeja do sistema ───────────────────────────────────────────────

def create_tray_icon():
    from PIL import Image, ImageDraw
    img = Image.new("RGB", (64, 64), color="#1e40af")
    draw = ImageDraw.Draw(img)
    draw.ellipse([8, 8, 56, 56], outline="white", width=6)
    draw.ellipse([20, 20, 44, 44], fill="white")
    return img


def run_with_tray() -> None:
    import pystray

    server_thread = threading.Thread(target=start_server, daemon=True)
    server_thread.start()

    print("Abrindo navegador...")
    time.sleep(2)
    webbrowser.open(APP_URL)

    def on_open(icon, item):
        webbrowser.open(APP_URL)

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
    """Fallback caso pystray não esteja disponível."""
    server_thread = threading.Thread(target=start_server, daemon=True)
    server_thread.start()

    print("\n" + "=" * 50)
    print(f"  {APP_NAME} iniciado com sucesso!")
    print(f"  Acesse: {APP_URL}")
    print("  Feche esta janela para encerrar o sistema.")
    print("=" * 50 + "\n")

    time.sleep(2)
    webbrowser.open(APP_URL)

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        pass


# ── Ponto de entrada ──────────────────────────────────────────────────────────

def main() -> None:
    if not is_admin():
        request_admin_elevation()
        return

    print(f"=== {APP_NAME} ===")
    configure_hosts()
    configure_environment()
    run_django_setup()

    try:
        run_with_tray()
    except ImportError:
        run_console_fallback()


if __name__ == "__main__":
    main()
