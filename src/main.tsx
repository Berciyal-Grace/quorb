import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { Widget } from './Widget';
import { Settings } from './Settings';
import { Overlay } from './Overlay';
import { DetailPanel } from './DetailPanel';
import './styles.css';

// Una sola build de frontend; cada ventana pinta su vista según su label.
const label = getCurrentWindow().label;
document.documentElement.dataset.window = label;

createRoot(document.getElementById('root')!).render(
  <StrictMode>{label === 'settings' ? <Settings /> : label === 'overlay' ? <Overlay /> : label === 'detail' ? <DetailPanel /> : <Widget />}</StrictMode>,
);
