import React from 'react';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-bg-primary">
      <div className="max-w-md w-full bg-bg-surface border border-border-subtle rounded-md p-6 shadow-lg text-center">
        <h1 className="text-2xl font-semibold mb-4 text-text-primary">Fan Application</h1>
        <p className="text-text-secondary mb-6 text-sm">
          Welcome to the Smart Stadium Fan Portal. Access concessions menus, checkout wait times, and interact with the AI Copilot.
        </p>
        <div className="border border-border-subtle bg-bg-elevated rounded p-4 mb-4 flex items-center justify-center">
          <span className="w-2 h-2 rounded-full bg-status-ok animate-pulse-subtle mr-2"></span>
          <span className="text-xs font-mono text-status-ok">STADIUM ONLINE</span>
        </div>
        <button className="w-full py-2 bg-accent-primary text-white rounded-sm text-sm font-semibold hover:opacity-90 transition-opacity">
          Open Concessions Menu
        </button>
      </div>
    </main>
  );
}