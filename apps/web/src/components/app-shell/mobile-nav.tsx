'use client';

import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { Sidebar } from './sidebar';

interface MobileNavProps {
  userRoles: string[];
  userName: string;
  userRole: string;
  initials: string;
}

export const MobileNav = ({ userRoles, userName, userRole, initials }: MobileNavProps) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Burger button */}
      <button
        onClick={() => setOpen(true)}
        className="flex size-10 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 lg:hidden"
        aria-label="Ouvrir le menu"
      >
        <Menu className="size-5" />
      </button>

      {/* Overlay + Drawer */}
      {open && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={() => setOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 z-50 w-64 lg:hidden">
            <div className="absolute top-0 right-0 z-10 p-2">
              <button
                onClick={() => setOpen(false)}
                className="flex size-8 items-center justify-center rounded-lg text-gray-400 hover:text-white"
                aria-label="Fermer le menu"
              >
                <X className="size-4" />
              </button>
            </div>
            <Sidebar
              userRoles={userRoles}
              userName={userName}
              userRole={userRole}
              initials={initials}
              onNavigate={() => setOpen(false)}
            />
          </div>
        </>
      )}
    </>
  );
};
