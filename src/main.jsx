import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { ShellProvider } from './components/shell/ShellContext'
import { ToastProvider } from './components/Toast'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ShellProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </ShellProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
