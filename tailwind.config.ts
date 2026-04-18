// tailwind.config.ts
import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // DGCC brand palette
        brand: {
          50:  '#eff6ff',
          100: '#dbeafe',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
        },
        surface: {
          DEFAULT: '#111620',
          2: '#161d2e',
          3: '#1c2540',
        },
        border: {
          DEFAULT: '#1f2d45',
          2: '#263350',
        },
      },
      fontFamily: {
        sans: ['Instrument Sans', 'ui-sans-serif', 'system-ui'],
        display: ['Syne', 'ui-sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
