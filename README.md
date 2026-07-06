# ObraGest

Sistema local para gestão de custos de obras.

## Stack

- **Backend:** Django 6 + Django REST Framework + SQLite
- **Frontend:** React + Vite + TypeScript + Tailwind CSS

## Desenvolvimento com Docker (recomendado)

Execute sempre na **raiz do projeto** (`ObraGest/`):

```bash
make up
# ou: docker compose up --build
```

- **App:** http://localhost:3000
- **API:** http://localhost:8000/api/

O backend roda migrations e seed de categorias automaticamente **ao iniciar o container**. Os dados (SQLite e backups) ficam no volume `obragest_data`.

### Hot reload

| Alteração | Comportamento |
|-----------|---------------|
| `views.py`, `serializers.py`, frontend `.tsx` | Recarrega automaticamente (polling habilitado) |
| `seed_categories.py` | Rode `make seed` |
| `models.py` | Rode `make makemigrations` e `make migrate` |
| `package.json` / dependências Python | Rode `make up` ou `docker compose up --build` |

Para rebuild automático de dependências, use:

```bash
make up-watch
# ou: docker compose watch
```

### Comandos úteis

```bash
make up              # subir tudo
make up-watch        # subir com watch de dependências
make logs            # ver logs do backend e frontend
make seed            # reaplicar categorias padrão
make makemigrations  # criar migrations
make migrate         # aplicar migrations
make down            # parar
docker compose down -v   # parar e apagar banco
```

### Executar comandos Django no container

```bash
make shell
docker compose exec backend python manage.py createsuperuser
```

## Desenvolvimento sem Docker

### Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install django django-cors-headers djangorestframework python-dotenv whitenoise
python manage.py migrate
python manage.py seed_categories
python manage.py runserver
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## Estrutura

- `/` — Lista de obras
- `/obras/:id` — Detalhe da obra com operações e extrato
- `/dashboard` — Resumo financeiro com filtros
- `/configuracoes` — Backup automático no Google Drive

## Backup no Google Drive

1. No [Google Cloud Console](https://console.cloud.google.com/), crie credenciais OAuth 2.0 (tipo **Aplicativo da Web**).
2. Adicione a URI de redirecionamento: `http://localhost:8080/google/callback/`
3. Ative a **Google Drive API** no projeto.
4. Salve o JSON de credenciais em `backend/google_client_secret.json` (montado automaticamente no Docker).
5. Em **Configurações**, clique em **Conectar Google Drive** e autorize a conta.

O sistema faz backup automático a cada 30 minutos (quando há alterações no banco) e mantém os últimos 20 backups na pasta **ObraGest Backups** do Drive. Se o banco local estiver vazio na primeira execução, o backup mais recente da nuvem é restaurado automaticamente.

## Variáveis de ambiente

| Variável | Descrição | Padrão |
|----------|-----------|--------|
| `OBRA_GEST_DATA_DIR` | Pasta dos dados (SQLite, backups) | `backend/` |
| `DEBUG` | Modo debug | `true` |
| `CORS_ALLOWED_ORIGINS` | Origens permitidas | `http://localhost:3000` |
| `API_PROXY` | URL do backend para proxy do Vite (Docker) | `http://127.0.0.1:8000` |
| `GOOGLE_OAUTH_CLIENT_SECRETS` | Caminho do JSON OAuth do Google | `data/google_client_secret.json` |
| `GOOGLE_DRIVE_REDIRECT_URI` | URI de callback OAuth | `http://localhost:8080/google/callback/` |
| `GOOGLE_DRIVE_BACKUP_INTERVAL_MINUTES` | Intervalo do backup automático | `30` |
| `GOOGLE_DRIVE_MAX_BACKUPS` | Máximo de backups no Drive | `20` |
| `FRONTEND_URL` | URL do frontend (redirect pós-login) | `http://localhost:3000` |
