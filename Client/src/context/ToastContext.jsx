// src/context/ToastContext.jsx
import React, { createContext, useCallback, useContext, useState } from 'react';
import { Toast } from '../components/UI/Toast';

const ToastContext = createContext(null);

let idCounter = 0;

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // showToast('Mesaj', 'error' | 'success' | 'info' | 'warning', süre_ms)
  const showToast = useCallback((message, type = 'info', duration = 3500) => {
    const id = ++idCounter;
    setToasts((prev) => [...prev, { id, message, type, duration }]);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      {/* Toast.css'teki .ui-toast:nth-child(2)/(3)/(4) yığın (stack)
          kuralları bu ortak sarmalayıcı sayesinde çalışıyor —
          her toast burada sırayla kardeş eleman olarak render ediliyor. */}
      <div className="toast-stack">
        {toasts.map((t) => (
          <Toast
            key={t.id}
            message={t.message}
            type={t.type}
            isVisible={true}
            duration={t.duration}
            onClose={() => removeToast(t.id)}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
};

// Herhangi bir bileşende: const { showToast } = useToast();
export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast() bir ToastProvider içinde kullanılmalı.');
  }
  return ctx;
};