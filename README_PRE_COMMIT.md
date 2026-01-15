# Configuration Pre-Commit - KAMBRIQ API

## Installation

### 1. Installer pre-commit

```bash
pip install pre-commit
```

Ou avec les dépendances de dev :

```bash
make dev-install
```

### 2. Installer les hooks pre-commit

```bash
pre-commit install
```

Ou avec make :

```bash
make pre-commit-install
```

## Utilisation

### Commit automatique

Les hooks pre-commit s'exécutent automatiquement à chaque `git commit`. 

**Tolérance zéro** : Si une vérification échoue, le commit est bloqué. Vous devez :
1. Corriger les erreurs
2. Les fichiers seront automatiquement formatés si possible
3. Relancer le commit

### Lancer manuellement sur tous les fichiers

```bash
pre-commit run --all-files
```

Ou avec make :

```bash
make pre-commit
```

## Hooks configurés

### 1. **Ruff Format** (formatage automatique)
- Formate le code Python selon les standards
- Corrige automatiquement si possible
- Bloque le commit si des erreurs de formatage restent

### 2. **Ruff Lint** (vérifications de code)
- Vérifie la qualité du code Python
- Corrige automatiquement certains problèmes
- Bloque le commit si des erreurs critiques restent

### 3. **MyPy** (vérification de types)
- Vérifie que les types Python sont corrects
- Mode strict activé
- Bloque le commit si des erreurs de typage sont détectées

### 4. **isort** (organisation des imports)
- Vérifie que les imports sont organisés correctement
- Bloque le commit si les imports ne sont pas organisés

### 5. **Pre-commit hooks standards**
- `trailing-whitespace` : Supprime les espaces en fin de ligne
- `end-of-file-fixer` : Ajoute une ligne vide en fin de fichier si manquante
- `check-yaml` : Vérifie la syntaxe YAML
- `check-json` : Vérifie la syntaxe JSON
- `check-toml` : Vérifie la syntaxe TOML
- `check-merge-conflict` : Détecte les marqueurs de conflit Git
- `debug-statements` : Détecte les `print()` et `pdb` oubliés
- `mixed-line-ending` : Normalise les fins de ligne (LF)

### 6. **pytest** (tests unitaires)
- Lance les tests unitaires à chaque commit
- Bloque le commit si des tests échouent

## Commandes Make disponibles

```bash
make format      # Formate le code
make lint        # Lance le linting
make type-check  # Vérifie les types
make test        # Lance les tests
make pre-commit  # Lance tous les hooks sur tous les fichiers
make clean       # Nettoie les fichiers générés
```

## Configuration

- **Ruff** : `ruff.toml` (formatage + linting)
- **MyPy** : `mypy.ini` (vérification de types)
- **Pre-commit** : `.pre-commit-config.yaml` (hooks)
- **Pytest** : `pytest.ini` et `pyproject.toml` (tests)

## Tolérance zéro

**Aucune exception** : Tous les hooks doivent passer avant le commit. Si un hook échoue :
1. Le commit est bloqué
2. Les erreurs sont affichées
3. Corrigez les erreurs et relancez le commit
4. Certaines corrections sont automatiques (formatage, imports)

## Désactiver temporairement (non recommandé)

Pour désactiver pre-commit pour un commit spécifique (exceptionnel) :

```bash
git commit --no-verify
```

**⚠️ Attention** : Ne pas utiliser sauf cas exceptionnel. Le code doit toujours respecter les standards.

