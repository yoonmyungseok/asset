import type { Config } from 'tailwindcss';

const config: Config = {
  theme: {
    extend: {
      colors: {
        primary: '#2563eb',
        success: '#16a34a',
        danger: '#dc2626',
      },
      width: {
        sidebar: '220px',
      },
      spacing: {
        sidebar: '220px',
      },
    },
  },
};

export default config;
