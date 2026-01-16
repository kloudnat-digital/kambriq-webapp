#!/bin/bash
# Script d'installation rapide pour pre-commit
# Usage: ./setup-pre-commit.sh

set -e

echo "🔧 Configuration Pre-Commit pour KAMBRIQ API"
echo ""

# Vérifier si Python est disponible
if ! command -v python3 &> /dev/null; then
    echo "❌ Erreur: Python 3 n'est pas installé"
    exit 1
fi

echo "✅ Python détecté: $(python3 --version)"
echo ""

# Installer pre-commit si pas déjà installé
if ! command -v pre-commit &> /dev/null; then
    echo "📦 Installation de pre-commit..."
    pip install pre-commit
else
    echo "✅ pre-commit déjà installé: $(pre-commit --version)"
fi

echo ""

# Installer les hooks
echo "🔗 Installation des hooks pre-commit..."
pre-commit install

echo ""
echo "✅ Pre-commit configuré avec succès!"
echo ""
echo "📝 Les hooks s'exécuteront automatiquement à chaque commit."
echo "💡 Pour tester maintenant: pre-commit run --all-files"
echo ""

