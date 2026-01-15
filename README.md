# kambriq-api

Backend API KAMBRIQ v3.0 - FastAPI avec architecture DDD (Domain-Driven Design).

## 🚀 Démarrage rapide

### Installation des dépendances

```bash
# Installation des dépendances de développement (inclut pre-commit)
make dev-install

# OU manuellement
pip install -e ".[dev]"
```

### Configuration Pre-Commit (OBLIGATOIRE)

Pre-commit est configuré avec **tolérance zéro** : tous les hooks doivent passer avant chaque commit.

```bash
# Installation rapide
./setup-pre-commit.sh

# OU manuellement
pre-commit install
```

**Important** : Les commits seront bloqués si :
- Le formatage n'est pas correct
- Des erreurs de linting sont détectées
- Des erreurs de typage sont présentes
- Les tests unitaires échouent

Voir [README_PRE_COMMIT.md](README_PRE_COMMIT.md) pour plus de détails.

## 📋 Commandes disponibles

```bash
make format      # Formate le code
make lint        # Lance le linting
make type-check  # Vérifie les types
make test        # Lance les tests
make pre-commit  # Lance tous les hooks sur tous les fichiers
make clean       # Nettoie les fichiers générés
```

## 🏗️ Architecture

Le projet suit une architecture DDD hexagonale :

```
src/
├── domain/          # Entities, repositories (interfaces)
├── application/     # Use cases, DTOs
├── infrastructure/  # Repositories implémentations, external services
└── presentation/    # FastAPI routers, guards, filters
```

## 🧪 Tests

```bash
# Tests unitaires
pytest tests/unit/ -v

# Tests avec coverage
make test-coverage
```

## 🐳 Docker

### Démarrage rapide avec Docker Compose

```bash
# Script de démarrage automatique
./scripts/docker-setup.sh

# OU manuellement
docker-compose up -d
```

### Commandes Docker Compose

```bash
# Démarrer PostgreSQL + API
docker-compose up

# Démarrer en arrière-plan
docker-compose up -d

# Arrêter
docker-compose down

# Arrêter et supprimer les volumes (⚠️ supprime les données DB)
docker-compose down -v

# Voir les logs
docker-compose logs -f api

# Voir les logs de tous les services
docker-compose logs -f

# Appliquer les migrations (dans le conteneur)
docker-compose exec api alembic upgrade head

# Lancer le seed (dans le conteneur)
docker-compose exec api python scripts/seed_database.py

# Lancer les tests (dans le conteneur)
docker-compose exec api pytest tests/ -v

# Accéder au shell du conteneur API
docker-compose exec api bash

# Accéder à PostgreSQL
docker-compose exec postgres psql -U postgres -d kambriq_db
```

**L'API sera accessible sur :** `http://localhost:8000`

**Swagger/OpenAPI :** `http://localhost:8000/docs`

### Variables d'environnement

Copier `.env.example` vers `.env` et ajuster les valeurs :

```bash
cp .env.example .env
```

**Variables importantes** :
- `DATABASE_URL` : URL de connexion PostgreSQL (configuré automatiquement dans docker-compose)
- `JWT_SECRET` : Clé secrète pour JWT (à changer en production)
- `ENV` : Environnement (development, production)

### Build Docker

```bash
# Build l'image
docker build -t kambriq-api:latest .

# Run l'image
docker run -p 8000:8000 \
  -e DATABASE_URL="postgresql+asyncpg://postgres:postgres@host.docker.internal:5432/kambriq_db" \
  kambriq-api:latest
```

## 📚 Documentation

- [README_PRE_COMMIT.md](README_PRE_COMMIT.md) - Configuration pre-commit
- [alembic/README.md](alembic/README.md) - Guide des migrations Alembic