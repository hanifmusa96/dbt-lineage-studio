import { GitBranch, Boxes, Moon, Sun, Upload } from 'lucide-react';
import type { Theme } from '../../features/theme/useTheme.ts';

export function TopBar({ projectName, theme, onToggleTheme, onImport }: {
  projectName?: string;
  theme: Theme;
  onToggleTheme: () => void;
  onImport: () => void;
}) {
  const nextTheme = theme === 'light' ? 'dark' : 'light';
  return <header className="topbar">
    <div className="brand"><div className="brand-mark"><GitBranch size={19} /></div><strong>lineage<span>studio</span></strong></div>
    <div className="topbar-divider" />
    <div className="workspace-label"><span className="workspace-icon"><Boxes size={15} /></span><span>{projectName || 'dbt project'}</span></div>
    <div className="topbar-spacer" />
    <div className="local-badge"><span className="live-dot" /> Local workspace</div>
    <button className="theme-button" onClick={onToggleTheme} aria-label={`Switch to ${nextTheme} mode`} title={`Switch to ${nextTheme} mode`}>
      {theme === 'light' ? <Moon size={17} /> : <Sun size={17} />}
    </button>
    <button className="import-button" onClick={onImport}><Upload size={15} /> Import artifacts</button>
  </header>;
}
