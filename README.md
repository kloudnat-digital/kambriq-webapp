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

## 📚 Documentation

- [README_PRE_COMMIT.md](README_PRE_COMMIT.md) - Configuration pre-commit