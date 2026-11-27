import { createRoot } from 'react-dom/client';
import '@xyflow/react/dist/style.css';
import './styles/base.css';
import { App } from './app/App.tsx';

const root = document.getElementById('root');
if (!root) throw new Error('Could not find the application root.');
createRoot(root).render(<App />);
