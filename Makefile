.PHONY: up up-watch down logs seed migrate makemigrations shell restart-backend restart-frontend \
        prepare-build

up:
	docker compose up --build

up-watch:
	docker compose watch

down:
	docker compose down

logs:
	docker compose logs -f backend frontend

seed:
	docker compose exec backend python manage.py seed

seed-categories:
	docker compose exec backend python manage.py seed_categories

makemigrations:
	docker compose exec backend python manage.py makemigrations

migrate:
	docker compose exec backend python manage.py migrate

shell:
	docker compose exec backend python manage.py shell

restart-backend:
	docker compose restart backend

restart-frontend:
	docker compose restart frontend

# ── Build do executável Windows (.exe) ────────────────────────────────────────
# O .exe é gerado automaticamente via GitHub Actions ao criar uma tag v*.*.* .
# Para gerar manualmente no Windows, execute build.bat na raiz do projeto.
# Para testar o frontend localmente antes de tagear:

prepare-build:
	@echo "Compilando frontend React para produção..."
	cd frontend && npm install && npm run build
	@echo ""
	@echo "Frontend compilado em frontend/dist/"
	@echo "Para gerar o .exe, crie uma tag: git tag v1.0.0 && git push origin v1.0.0"
