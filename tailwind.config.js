/** @type {import('tailwindcss').Config} */
export default {
    darkMode: ["class"],
    content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
  theme: {
  	extend: {
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		colors: {
  			devin: {
  				purple: '#3969CA',
  				green: '#21C19A',
  				blue: '#0294DE',
  				'purple-light': '#5a8aef',
  				'green-light': '#3de0b8',
  				'blue-light': '#2db4f5',
  				'purple-dark': '#2a4f99',
  				'green-dark': '#198f73',
  				'blue-dark': '#0270a8',
  			}
  		}
  	}
  },
  plugins: [import("tailwindcss-animate")],
}

