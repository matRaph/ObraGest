.PHONY: up up-watch down logs seed migrate makemigrations shell restart-backend restart-frontend

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
