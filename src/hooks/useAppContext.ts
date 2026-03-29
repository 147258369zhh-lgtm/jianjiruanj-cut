import { createContext, useContext } from 'react';
import { useAppController } from './useAppController';

export type AppControllerState = ReturnType<typeof useAppController>;

export const AppContext = createContext<AppControllerState | null>(null);

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within an AppContext.Provider');
  }
  return context;
}
