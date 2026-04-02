# Fieldcast – Weather App for Farmers & Gardeners

Fieldcast is a weather decision-support app designed for outdoor work, with a primary focus on farmers and secondary support for gardeners and florists.
It combines live forecast data with practical, task-oriented insights such as spray drift risk, frost warnings, rainfall trends, and livestock-focused alerts.

## Why choose Fieldcast?

Many weather apps show raw forecast data but do not help users decide what actions are safe or productive.
Fieldcast focuses on usability for weather-dependent stakeholders by supporting:

- Effectiveness: Quick access to key weather risks and recommended actions
- Efficiency: Fast location search, and saved locations
- Safety: Search error handling, warning panels, and risk-focused widgets
- Utility: Agriculture-specific features beyond basic weather display
- Learnability: Clear, consistent layout and straightforward workflows
- Memorability: Predictable controls and reusable location shortcuts

## Features
- Search by city name or UK postcode
- Live weather data from OpenWeather: temperature, humidity, wind speed, rainfall, and UV index
- Forecast views: hourly, daily, weekly, and monthly with weather icons
- Spray drift risk indicator based on wind, gusts, humidity
- Frost risk and livestock weather alerts
- Rainfall accumulation views for 24h, 7d, and 30d periods
- 7-day visual trend graph with soil moisture outlook

## Prerequisites
- Node.js (version 18 or above) — download from https://nodejs.org
- An OpenWeather API key supporting the One Call API 3.0 plan

## OpenWeather API key

Fieldcast reads your key from environment variables at build/dev time (Vite). Follow these steps before running the app.

1. **Get a key**  
   Sign up at [OpenWeather](https://openweathermap.org/api), create an API key, and ensure your subscription includes **One Call API 3.0** (the app uses that product).

2. **Create `.env.local` in the project root**  
   The root is the same directory as `package.json` (not inside `src`). On macOS or Linux you can run:
   ```bash
   touch .env.local
   ```
   Or create a new file named exactly `.env.local` in your editor.

3. **Add the variable**  
   Open `.env.local` and add a single line (replace the placeholder with your real key):
   ```
   VITE_OPENWEATHER_API_KEY=your_actual_key_here
   ```
   Use the name **`VITE_OPENWEATHER_API_KEY`** exactly—Vite only exposes variables that start with `VITE_` to the app. Do not put spaces around `=`. Quotes are only needed if your key contains characters that would confuse the shell; usually they are not required.

4. **Restart the dev server**  
   Environment files are read when Vite starts. After you create or change `.env.local`, stop the dev server (`Ctrl+C`) and run `npm run dev` again.

5. **Keep the key private**  
   `.env.local` and other `.env*` files are listed in `.gitignore` and should not be committed. Do not paste your key into public repos or client-side code outside this local file.

## Installation & Setup

1. Clone the repository:
git clone https://github.com/abzo1st/Fieldcast.git

2. Move to project folder:
cd Fieldcast

3. Install dependencies:
npm install

4. Configure your OpenWeather API key in `.env.local` as described in [OpenWeather API key](#openweather-api-key) above.

## Running the App

1. Open command prompt and run:
npm run dev

2. Close the application:
Ctrl+C

Then open http://localhost:5173 in your browser.

## Project Structure

- src: Application source code
- src/app: App-level routing, pages, and APIs
- src/app/pages: Main screens, including landing and dashboard
- src/app/api: Data fetching and search utilities
- src/app/components: Shared UI and custom components
- src/styles: Global styles, theme, and Tailwind integration
- ATTRIBUTIONS.md: Third-party assets and library attribution

## Troubleshooting

- Invalid API key: Verify .env.local value and restart the dev server
- Invalid API KEY: Ensure API key supports One Call 3.0
- Ensure API key is active and not disabled
- No results from search: Try a full location name or a valid UK postcode

## Attribution
See ATTRIBUTIONS.md for third-party libraries and assets used.
