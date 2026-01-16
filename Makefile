.PHONY: help install dev-install pre-commit-install format lint type-check test pre-commit clean

help: ## Affiche cette aide
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

install: ## Installe les dépendances de base
	pip install -e .

dev-install: ## Installe les dépendances de développement
	pip install -e ".[dev]"

pre-commit-install: ## Installe les hooks pre-commit
	pre-commit install

format: ## Formate le code avec ruff
	ruff format src/ tests/

lint: ## Lance le linting avec ruff
	ruff check src/ tests/ --fix

type-check: ## Vérifie les types avec mypy
	mypy src/

test: ## Lance les tests
	pytest tests/ -v

test-unit: ## Lance uniquement les tests unitaires
	pytest tests/unit/ -v

test-coverage: ## Lance les tests avec coverage
	pytest tests/ --cov=src --cov-report=term-missing --cov-report=html

pre-commit: ## Lance pre-commit sur tous les fichiers
	pre-commit run --all-files

clean: ## Nettoie les fichiers générés
	find . -type d -name __pycache__ -exec rm -r {} +
	find . -type f -name "*.pyc" -delete
	find . -type d -name "*.egg-info" -exec rm -r {} +
	rm -rf .pytest_cache .mypy_cache .coverage htmlcov build dist

