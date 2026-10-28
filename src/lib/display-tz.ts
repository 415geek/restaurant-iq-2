/**
 * Times are shown in the restaurant's local time zone, the same on the server (UTC on Vercel) and in the browser.
 * Without a fixed zone, server-rendered and hydrated text differ (React #418) and owners see UTC times.
 */
export const DISPLAY_TZ = "America/Los_Angeles";
