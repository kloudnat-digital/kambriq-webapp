import SectionHeader from '@/components/section/header';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Check, Clock } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

type Lecture = { title: string; description: string };
type Module = {
  name: string;
  title: string;
  duration: string;
  description: string;
  lectures: Lecture[];
};

const KBSModules = async () => {
  const t = await getTranslations('products.kbs.modulesDetail');
  const modules = t.raw('items') as Module[];

  return (
    <div className="py-20">
      <SectionHeader title={t('title')} titleClassName="text-4xl sm:text-5xl" />

      <div className="mx-auto mt-16 max-w-4xl">
        <Accordion type="single" collapsible className="rounded-lg border border-accent-600/20">
          {modules.map((module) => (
            <AccordionItem
              key={module.name}
              value={module.title}
              className="rounded-none border-border bg-background px-6 first:rounded-t-lg last:rounded-b-lg last:border-b-0"
            >
              <AccordionTrigger className="hover:no-underline">
                <div className="relative pl-20 text-base/7 text-gray-600">
                  <div className="font-semibold text-gray-900">
                    <Badge className="absolute top-1 left-0 border border-gold-600 bg-gold-50 text-gold-700">
                      {module.name}
                    </Badge>
                    {module.title}
                  </div>
                  <div className="flex items-center gap-x-3">
                    <Clock className="size-4" />
                    <p>{module.duration}</p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="flex flex-col gap-y-2 pb-6 text-base/7 leading-relaxed text-muted-foreground">
                <p>{module.description}</p>
                <div>
                  <p className="font-medium">{t('contentLabel')}</p>
                  <div className="mt-2 flex flex-col gap-y-2">
                    {module.lectures.map((lecture) => (
                      <div key={lecture.title} className="relative pl-8 text-base/7">
                        <div className="font-semibold">
                          <Check className="absolute top-1 left-0 size-5 text-gold-700" />
                          {lecture.title}
                        </div>
                        {lecture.description}
                      </div>
                    ))}
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </div>
  );
};

export default KBSModules;
