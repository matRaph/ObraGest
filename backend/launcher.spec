# -*- mode: python ; coding: utf-8 -*-
#
# Spec do PyInstaller para gerar ObraGest.exe
#
# Pré-requisitos antes de executar este spec:
#   1. Build do frontend:  cd ..\frontend && npm install && npm run build
#   2. Static files:       python manage.py collectstatic --noinput
#   3. Dependências:       pip install pyinstaller waitress pystray pillow
#
# Executar com:
#   pyinstaller launcher.spec --clean --noconfirm

from PyInstaller.utils.hooks import collect_data_files
import os

block_cipher = None

# Templates/static do DRF e do Django admin (evita TemplateDoesNotExist no exe)
_extra_datas = collect_data_files("rest_framework") + collect_data_files(
    "django.contrib.admin"
)

_datas = [
    # Frontend React compilado
    ('../frontend/dist', 'frontend/dist'),
    # Arquivos estáticos do Django admin (gerados por collectstatic)
    ('staticfiles', 'staticfiles'),
    # Código da aplicação Django
    ('construction', 'construction'),
    ('obragest', 'obragest'),
    # Templates
    ('templates', 'templates'),
    # Identidade visual usada pelo ícone da bandeja
    ('obragest-tray.png', '.'),
]

# OAuth do Google embutido no .exe (gerado no CI a partir do secret)
if os.path.isfile('google_client_secret.json'):
    _datas.append(('google_client_secret.json', '.'))

a = Analysis(
    ['launcher.py'],
    pathex=['.'],
    binaries=[],
    datas=_datas + _extra_datas,
    hiddenimports=[
        'django',
        'django.template.defaulttags',
        'django.template.defaultfilters',
        'django.template.loader_tags',
        'django.contrib.staticfiles',
        'django.contrib.staticfiles.finders',
        'corsheaders',
        'corsheaders.middleware',
        'rest_framework',
        'rest_framework.authentication',
        'rest_framework.permissions',
        'rest_framework.pagination',
        'rest_framework.renderers',
        'whitenoise',
        'whitenoise.middleware',
        'whitenoise.storage',
        'obragest',
        'obragest.settings',
        'obragest.urls',
        'obragest.wsgi',
        'obragest.spa',
        'obragest.pagination',
        'construction',
        'construction.apps',
        'construction.models',
        'construction.views',
        'construction.serializers',
        'construction.urls',
        'construction.admin',
        'construction.constants',
        'construction.services',
        'construction.services.backup',
        'construction.services.google_drive',
        'construction.management',
        'construction.management.commands',
        'construction.management.commands.seed',
        'construction.management.commands.seed_categories',
        'google.auth',
        'google.auth.transport.requests',
        'google.oauth2.credentials',
        'googleapiclient',
        'googleapiclient.discovery',
        'waitress',
        'waitress.task',
        'waitress.server',
        'waitress.runner',
        'waitress.utilities',
        'pystray',
        'pystray._win32',
        'PIL',
        'PIL.Image',
        'PIL.ImageDraw',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        'tkinter',
        'matplotlib',
        'numpy',
        'scipy',
        'watchfiles',
        'IPython',
        'jupyter',
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='ObraGest',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    uac_admin=True,
    icon='obragest.ico',
)
