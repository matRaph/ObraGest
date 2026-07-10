/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          green: {
            DEFAULT: "#4f7c2f",
            dark: "#3e6225",
            light: "#d4e8c6",
            bg: "#eef5e9",
          },
          blue: {
            DEFAULT: "#09264c",
            dark: "#0d3470",
            light: "#dce4ef",
          },
          gray: {
            DEFAULT: "#3a414d",
            light: "#f0f1f3",
            muted: "#6d7580",
            border: "#d4d6da",
          },
        },
      },
    },
  },
  plugins: [],
};
