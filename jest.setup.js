/* eslint-disable @typescript-eslint/no-require-imports */
// Mocks for native-backed Expo modules so RN component tests render under jest
// without pulling their native font/gradient loaders.

jest.mock("@expo/vector-icons", () => {
  const React = require("react");
  const { Text } = require("react-native");
  const Icon = ({ name, ...props }) => React.createElement(Text, props, name);
  return new Proxy({}, { get: () => Icon });
});

jest.mock("expo-linear-gradient", () => {
  const { View } = require("react-native");
  return { LinearGradient: View };
});

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);
