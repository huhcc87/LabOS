import { createContext, useContext } from 'react';

export const NavigationContext = createContext<(page: string) => void>(() => {});
export const useNavigate = () => useContext(NavigationContext);
