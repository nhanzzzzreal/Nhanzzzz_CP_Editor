import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      port: 3690, // Frontend (Vite) sẽ chạy trên cổng 3690
      proxy: {
        '/api': { // Proxy tất cả các request bắt đầu bằng /api
          target: 'http://localhost:3691', // Đến backend FastAPI của bạn trên cổng 3691
          changeOrigin: true, // Quan trọng để tránh lỗi CORS
        },
      },
        watch: {
          // Bỏ qua theo dõi thư mục workspace để không bị auto-reload
          ignored: ['**/workspace/**', '**/.cpe/**', '**/cpe_global_config.json', '**/*.json'],
        }
    },
  };
});
