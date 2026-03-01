import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  // Убираем StrictMode для production (чтобы не дублировались API запросы при mount в dev режиме)
  <App />
)