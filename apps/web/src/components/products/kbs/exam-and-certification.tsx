import React from 'react';
import SectionHeader from '@/components/section/header';
import { CheckIcon } from 'lucide-react';

const chapters = [
  {
    id: 'exam-format',
    title: "Format de l'examen",
    content: ['QCM de 30 questions', 'Durée : 30 minutes', 'Score minimal : 70%'],
  },
  {
    id: 'after-certification',
    title: 'Après certification',
    content: ['Certificat KCA téléchargeable', 'Éligibilité KAMNET', 'Accès au réseau agents'],
  },
];

const ExamAndCertification = () => {
  return (
    <div className="container mx-auto px-4 py-5 sm:px-6 lg:px-8">
      <SectionHeader
        titleClassName="text-4xl sm:text-5xl"
        title={'Examen final et certification'}
        subtitle={'Validez vos compétences et devenez Agent Certifié KAMBRIQ'}
      />

      <div className="mx-auto mt-10 grid max-w-md grid-cols-1 gap-5 lg:max-w-4xl lg:grid-cols-2">
        {chapters.map((chapter) => (
          <div
            key={chapter.id}
            className="flex flex-col justify-between rounded-lg bg-gold-50 p-5 shadow-xs outline outline-gold-700 sm:p-6"
          >
            <div>
              <p className="text-3xl font-semibold tracking-tight text-gold-900">{chapter.title}</p>
              <ul className="mt-8 space-y-4 text-sm/6 text-gold-800">
                {chapter.content.map((feature) => (
                  <li key={feature} className="flex gap-x-3">
                    <CheckIcon aria-hidden="true" className="h-6 w-5 flex-none text-gold-600" />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ExamAndCertification;
