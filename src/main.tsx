import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'
import './worlds.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App initialPath={window.location.pathname} />
  </StrictMode>,
)
