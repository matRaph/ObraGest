# ObraGest

Sistema local para gestão de custos de obras.

## Stack

- **Backend:** Django 6 + Django REST Framework + SQLite
- **Frontend:** React + Vite + TypeScript + Tailwind CSS

## Desenvolvimento com Docker (recomendado)

```bash
docker compose up --build
```

- **App:** http://localhost:5173
- **API:** http://localhost:8000/api/

O backend roda migrations e seed de categorias automaticamente ao iniciar. Os dados (SQLite e backups) ficam no volume `obragest_data`.

### Comandos úteis

```bash
# Rodar em background
docker compose up -d --build

# Ver logs
docker compose logs -f

# Parar
docker compose down

# Resetar banco de dados
docker compose down -v
```

### Executar comandos Django no container

```bash
docker compose exec backend python manage.py shell
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
- `/configuracoes` — Backup e restauração manual

## Variáveis de ambiente

| Variável | Descrição | Padrão |
|----------|-----------|--------|
| `OBRA_GEST_DATA_DIR` | Pasta dos dados (SQLite, backups) | `backend/` |
| `DEBUG` | Modo debug | `true` |
| `CORS_ALLOWED_ORIGINS` | Origens permitidas | `http://localhost:5173` |
| `API_PROXY` | URL do backend para proxy do Vite (Docker) | `http://127.0.0.1:8000` |
