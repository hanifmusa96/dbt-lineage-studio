import { Boxes, CircleHelp } from 'lucide-react';

export function NavRail({ onBrowse, onAbout }: { onBrowse: () => void; onAbout: () => void }) {
  return <aside className="rail">
    <div className="rail-group"><button className="rail-button" title="Browse resources" onClick={onBrowse}><Boxes size={19} /></button></div>
    <div className="rail-bottom"><button className="rail-button" title="About this view" onClick={onAbout}><CircleHelp size={19} /></button></div>
  </aside>;
}
