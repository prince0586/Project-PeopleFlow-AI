import React from 'react';
import { LogOut, LogIn, Sun, Moon } from 'lucide-react';
import { User } from 'firebase/auth';
import { signIn, signOut } from '../firebase';

interface HeaderProps {
  user: User | null;
  onToggleTheme: () => void;
  currentTheme: 'light' | 'dark' | 'high-contrast';
}

/**
 * Header Component
 * 
 * The primary navigation and branding bar of the application.
 * Handles user authentication display and sign-in/out actions.
 * 
 * @component
 */
export const Header = React.memo(({ user, onToggleTheme, currentTheme }: HeaderProps) => (
  <header className="bg-surface border-bottom border-border px-10 py-4 flex justify-between items-center sticky top-0 z-50 shadow-sm" role="banner">
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 bg-brand rounded-md flex items-center justify-center text-white font-bold text-lg" aria-hidden="true">F</div>
      <h1 className="text-lg font-semibold tracking-tight text-text-main">
        EVENTFLOW AI <span className="font-normal text-text-sub ml-2 hidden sm:inline">Enterprise Venue System</span>
      </h1>
    </div>
    <div className="flex items-center gap-4">
      <button 
        onClick={onToggleTheme}
        className="p-2 hover:bg-bg rounded-full transition-colors text-text-sub focus:outline-none focus:ring-2 focus:ring-brand"
        aria-label={`Switch to ${currentTheme === 'dark' ? 'light' : 'dark'} mode`}
      >
        {currentTheme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
      </button>
      
      {user ? (
        <div className="flex items-center gap-3">
          <img 
            src={user.photoURL || ''} 
            alt={`Profile of ${user.displayName}`} 
            className="w-8 h-8 rounded-full border border-border" 
            referrerPolicy="no-referrer" 
          />
          <button 
            onClick={signOut} 
            className="p-2 hover:bg-bg rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand"
            aria-label="Sign Out"
          >
            <LogOut size={18} className="text-text-sub" />
          </button>
        </div>
      ) : (
        <button 
          onClick={signIn} 
          className="flex items-center gap-2 bg-brand text-white px-4 py-2 rounded-lg font-medium hover:bg-brand-dark transition-all focus:ring-2 focus:ring-brand focus:ring-offset-2"
          aria-label="Sign In with Google"
        >
          <LogIn size={18} />
          Sign In
        </button>
      )}
    </div>
  </header>
));

Header.displayName = 'Header';
