import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './i18n';
import { App } from './App';
import { TourProvider } from './tour/TourContext';
import './styles.css';

const queryClient = new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false } } });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <TourProvider>
          <App />
        </TourProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
