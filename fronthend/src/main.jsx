import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import ErrorBoundary from './ErrorBoundary'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Create a react-query client for the app
const queryClient = new QueryClient()

// Global handler to surface uncaught errors during development
if (import.meta.env.MODE === 'development') {
    // eslint-disable-next-line no-console
    window.addEventListener('error', (e) => console.error('window.error', e))
    // eslint-disable-next-line no-console
    window.addEventListener('unhandledrejection', (e) => console.error('unhandledrejection', e))
}

ReactDOM.createRoot(document.getElementById('root')).render(
    <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
            <App />
        </QueryClientProvider>
    </ErrorBoundary>
)