'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Search, Clock } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

type Article = {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  readTime: number;
  date: string;
};

const ARTICLES: Article[] = [
  {
    slug: 'guide-achat-terrain-cameroun',
    title: 'Guide complet pour acheter un terrain au Cameroun',
    excerpt:
      "Tout ce que vous devez savoir sur l'acquisition foncière au Cameroun depuis la diaspora.",
    category: 'Lands',
    readTime: 8,
    date: '2025-01-15',
  },
  {
    slug: 'comprendre-titre-foncier',
    title: 'Comprendre les types de titres fonciers',
    excerpt: 'TFL, VEFL, VEFIL : les différences, les risques et comment choisir.',
    category: 'Lands',
    readTime: 5,
    date: '2025-01-20',
  },
  {
    slug: 'verification-terrain-importance',
    title: "Pourquoi vérifier un terrain avant d'acheter ?",
    excerpt: 'Les arnaques foncières sont fréquentes. Voici comment KAMBRIQ Verify vous protège.',
    category: 'Verify',
    readTime: 6,
    date: '2025-02-01',
  },
  {
    slug: 'devenir-agent-kamnet',
    title: 'Comment devenir agent KAMNET',
    excerpt:
      'Les étapes pour rejoindre le réseau KAMBRIQ et générer des revenus depuis la diaspora.',
    category: 'KAMNET',
    readTime: 4,
    date: '2025-02-10',
  },
  {
    slug: 'financement-terrain-diaspora',
    title: 'Financement et paiement échelonné',
    excerpt: 'Options de paiement, conditions et comment constituer votre dossier de financement.',
    category: 'Lands',
    readTime: 7,
    date: '2025-02-18',
  },
  {
    slug: 'kbs-certification-kca',
    title: 'La certification KCA expliquée',
    excerpt: "Qu'est-ce que la KAMBRIQ Business School et comment obtenir votre certification.",
    category: 'KBS',
    readTime: 5,
    date: '2025-02-25',
  },
];

const CATEGORIES = ['all', 'Lands', 'Verify', 'KAMNET', 'KBS'];

export const KbContent = () => {
  const t = useTranslations('knowledgeBase');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');

  const filtered = ARTICLES.filter((a) => {
    if (category !== 'all' && a.category !== category) return false;
    if (search) {
      const q = search.toLowerCase();
      return a.title.toLowerCase().includes(q) || a.excerpt.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="mx-auto max-w-5xl space-y-10 px-6 py-14 sm:px-8">
      {/* Search */}
      <div className="relative">
        <Search className="absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-gray-400" />
        <Input
          className="pl-10"
          placeholder={t('searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${category === cat ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            {cat === 'all' ? t('allArticles') : cat}
          </button>
        ))}
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <p className="py-12 text-center text-gray-400">{t('noResults')}</p>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((article) => (
            <Link
              key={article.slug}
              href={`/knowledge-base/${article.slug}`}
              className="group flex flex-col rounded-2xl border border-border bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
            >
              <Badge variant="outline" className="mb-3 w-fit text-xs">
                {article.category}
              </Badge>
              <h3 className="mb-2 line-clamp-2 text-sm font-semibold text-gray-900 transition-colors group-hover:text-primary-600">
                {article.title}
              </h3>
              <p className="line-clamp-3 flex-1 text-xs text-gray-500">{article.excerpt}</p>
              <div className="mt-4 flex items-center gap-3 text-xs text-gray-400">
                <span className="flex items-center gap-1">
                  <Clock className="size-3" />
                  {article.readTime} min
                </span>
                <span>{new Date(article.date).toLocaleDateString('fr-FR')}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};
