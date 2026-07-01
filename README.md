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
- `/configuracoes` — Backup e restauração manual

## Variáveis de ambiente

| Variável | Descrição | Padrão |
|----------|-----------|--------|
| `OBRA_GEST_DATA_DIR` | Pasta dos dados (SQLite, backups) | `backend/` |
| `DEBUG` | Modo debug | `true` |
| `CORS_ALLOWED_ORIGINS` | Origens permitidas | `http://localhost:3000` |
| `API_PROXY` | URL do backend para proxy do Vite (Docker) | `http://127.0.0.1:8000` |
