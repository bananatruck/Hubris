import { createRoot } from 'react-dom/client';
import { HubrisProvider } from './state/HubrisProvider';
import { App } from './ui/App';
import './styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('Missing Hubris root element.');
createRoot(root).render(<HubrisProvider><App surface="popup" /></HubrisProvider>);
