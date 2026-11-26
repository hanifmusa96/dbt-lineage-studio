import { createRoot } from 'react-dom/client';
import { App } from './app/App.tsx';
import '@xyflow/react/dist/style.css';
import './app/styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('Could not find the application root.');
createRoot(root).render(<App />);
