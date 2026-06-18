// React Native / Expo component + hook tests (`*.test.tsx`).
// The backend / pure-logic suite stays on vitest (`*.test.ts`) — the two runners
// are split by file extension so they never collide.
module.exports = {
  preset: "jest-expo",
  testMatch: ["**/?(*.)+(test).tsx"],
  testPathIgnorePatterns: ["/node_modules/", "/hardware-archive/"],
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|react-native-gifted-charts|@sentry/.*))",
  ],
};
