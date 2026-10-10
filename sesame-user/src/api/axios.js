import axios from 'axios';

// ⚠️ Remplace par l'IP de ton PC si tu testes sur téléphone physique
// Exemple : http://192.168.1.10:3000
export const BASE_URL = 'http://localhost:3000'; // Android emulator 192.168.56.1
// const BASE_URL = 'http://localhost:3000'; // iOS simulator

const api = axios.create({  
  baseURL: BASE_URL,
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  // token ajouté dynamiquement depuis AuthContext si besoin
  return config;
});

export default api;