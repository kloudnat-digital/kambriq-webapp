#!/bin/bash
# Script de démarrage rapide avec Docker Compose
# Usage: ./scripts/docker-setup.sh

set -e

echo "🐳 Configuration Docker pour KAMBRIQ API"
echo ""

# Vérifier si Docker est disponible
if ! command -v docker &> /dev/null; then
    echo "❌ Erreur: Docker n'est pas installé"
    exit 1
fi

if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "❌ Erreur: Docker Compose n'est pas installé"
    exit 1
fi

echo "✅ Docker détecté: $(docker --version)"
echo ""

# Créer fichier .env si n'existe pas
if [ ! -f .env ]; then
    echo "📝 Création du fichier .env..."
    cat > .env << EOF
# Database Configuration
DATABASE_URL=postgresql+asyncpg://postgres:postgres@postgres:5432/kambriq_db

# JWT Configuration
JWT_SECRET=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)
JWT_ALGORITHM=HS256
JWT_EXPIRES_IN=900
JWT_REFRESH_EXPIRES_IN=604800

# Environment
ENV=development

# API Configuration
API_HOST=0.0.0.0
API_PORT=8000

# Cookie Configuration
COOKIE_SECURE=false
COOKIE_SAME_SITE=lax
EOF
    echo "✅ Fichier .env créé"
else
    echo "ℹ️  Fichier .env existe déjà"
fi

echo ""
echo "🚀 Démarrage des services..."
echo ""

# Démarrer les services
docker-compose up -d

echo ""
echo "⏳ Attente que PostgreSQL soit prêt..."
sleep 5

echo ""
echo "📊 État des services:"
docker-compose ps

echo ""
echo "✅ Services démarrés!"
echo ""
echo "📝 Prochaines étapes:"
echo "   1. Appliquer les migrations: docker-compose exec api alembic upgrade head"
echo "   2. Lancer le seed: docker-compose exec api python scripts/seed_database.py"
echo "   3. Accéder à l'API: http://localhost:8000"
echo "   4. Voir les logs: docker-compose logs -f api"
echo ""

