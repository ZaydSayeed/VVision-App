import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { renderHook, waitFor } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

jest.mock("expo-linking", () => ({
  getInitialURL: jest.fn(),
  addEventListener: jest.fn(() => ({ remove: jest.fn() })),
}));
jest.mock("../navigation/navigationRef", () => ({
  navigationRef: { isReady: jest.fn(() => true), navigate: jest.fn() },
}));

import { useInviteDeepLink } from "./useInviteDeepLink";
import * as Linking from "expo-linking";
import { navigationRef } from "../navigation/navigationRef";

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
});

describe("useInviteDeepLink", () => {
  it("stashes the token from a cold-start invite URL", async () => {
    (Linking.getInitialURL as any).mockResolvedValue("vela://invite/abc123def");

    renderHook(() => useInviteDeepLink(null, null, () => {}, null));

    await waitFor(async () =>
      expect(await AsyncStorage.getItem("@vela/pending_invite")).toBe("abc123def")
    );
  });

  it("navigates to AcceptInvite when a pending token surfaces after login", async () => {
    (Linking.getInitialURL as any).mockResolvedValue(null);
    const clear = jest.fn();

    renderHook(() =>
      useInviteDeepLink({ id: "u1", role: "caregiver" } as any, "tok99", clear, true)
    );

    await waitFor(() =>
      expect(navigationRef.navigate).toHaveBeenCalledWith("AcceptInvite", { token: "tok99" })
    );
    expect(clear).toHaveBeenCalled();
  });
});
