/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: '#0a0e17',
        card: '#111827',
        'card-hover': '#1f2937',
        border: '#1e293b',
        'soc-blue': '#38bdf8',
        'soc-green': '#10b981',
        'soc-amber': '#f59e0b',
        'soc-rose': '#f43f5e',
        'soc-purple': '#a855f7',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      }
    },
  },
  plugins: [],
}
