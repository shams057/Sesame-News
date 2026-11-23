import { useQuery } from '@tanstack/react-query';
import api from './api';

const get = (url, params) => api.get(url, { params }).then((response) => response.data);

export const useDepartments = () => useQuery({ queryKey: ['departments'], queryFn: () => get('/departments'), staleTime: 5 * 60 * 1000 });
export const useCategories = () => useQuery({ queryKey: ['categories'], queryFn: () => get('/categories'), staleTime: 60 * 1000 });
export const useAdmins = () => useQuery({ queryKey: ['admins'], queryFn: () => get('/admins'), staleTime: 60 * 1000 });

export { get };
