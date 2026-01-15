# Alembic Migrations

## Configuration

Alembic est configuré pour utiliser SQLAlchemy async avec PostgreSQL.

## Variables d'environnement

Définir `DATABASE_URL` avant d'exécuter les commandes Alembic :

```bash
export DATABASE_URL="postgresql+asyncpg://user:password@localhost:5432/kambriq_db"
```

Pour PostgreSQL local :
```bash
export DATABASE_URL="postgresql+asyncpg://postgres:password@localhost:5432/kambriq_dev"
```

## Commandes principales

### Vérifier l'état actuel
```bash
alembic current
```

### Créer une nouvelle migration
```bash
# Migration automatique (générée depuis les modèles)
alembic revision --autogenerate -m "Description de la migration"

# Migration manuelle
alembic revision -m "Description de la migration"
```

### Appliquer les migrations
```bash
# Appliquer toutes les migrations en attente
alembic upgrade head

# Appliquer jusqu'à une version spécifique
alembic upgrade <revision>
```

### Revenir en arrière
```bash
# Revenir à la version précédente
alembic downgrade -1

# Revenir à une version spécifique
alembic downgrade <revision>

# Revenir à la base (supprime toutes les tables)
alembic downgrade base
```

### Voir l'historique
```bash
# Historique complet
alembic history

# Historique avec plus de détails
alembic history --verbose
```

## Structure

- `versions/` : Fichiers de migration
- `env.py` : Configuration Alembic (async)
- `script.py.mako` : Template pour les nouvelles migrations
- `alembic.ini` : Configuration principale (dans le répertoire racine)

## Migration initiale

La migration `001_initial_schema` crée :
- Toutes les tables (users, roles, resources, permissions, etc.)
- Toutes les contraintes (UNIQUE, FOREIGN KEY)
- Tous les index
- Format matrice permissions (36 colonnes bool)

## Tests

Les migrations sont testées dans `tests/integration/test_migrations.py` :
- Test upgrade (création des tables)
- Test downgrade (suppression des tables)
- Test re-upgrade (vérification idempotence)

```bash
pytest tests/integration/test_migrations.py -v
```

