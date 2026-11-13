import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          navy: '#002941',
          'navy-deep': '#001d2e',
          slate: '#335467',
          mint: '#cfe8e1',
          'mint-soft': '#eaf5f1',
          canvas: '#f7fbf9',
          surface: '#ffffff',
          divider: '#b8d8cf',
          'alert-text': '#7f1d1d',
          'alert-bg': '#fdf2f2',
        },
      },
      fontFamily: {
        sans: ['var(--font-jakarta)', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['var(--font-jetbrains-mono)', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
