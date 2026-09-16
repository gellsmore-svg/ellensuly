.PHONY: test backend-test frontend-test e2e build up

backend-test:
	cd backend && . .venv/bin/activate && pytest -q

frontend-test:
	cd frontend && npm test

e2e:
	cd frontend && npm run test:e2e

test: backend-test frontend-test

build:
	cd frontend && npm run build

up:
	docker compose up --build
