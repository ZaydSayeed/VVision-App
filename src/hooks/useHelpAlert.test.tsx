import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { renderHook, act, waitFor } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

jest.mock("../api/client", () => ({
  fetchHelpAlerts: jest.fn(),
  createHelpAlert: jest.fn(),
  dismissHelpAlert: jest.fn(),
  resolveHelpAlert: jest.fn(),
  acknowledgeHelpAlert: jest.fn(),
}));

import { useHelpAlert } from "./useHelpAlert";
import * as client from "../api/client";

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  (client.fetchHelpAlerts as any).mockResolvedValue([]);
});

describe("useHelpAlert — SOS send", () => {
  it("delivers the SOS via the durable queue and records the server ack (SAFE-1)", async () => {
    (client.createHelpAlert as any).mockResolvedValue({
      id: "a1",
      timestamp: new Date().toISOString(),
      dismissed: false,
    });

    const { result } = renderHook(() => useHelpAlert());

    await act(async () => {
      await result.current.sendHelp();
    });

    expect(client.createHelpAlert).toHaveBeenCalledTimes(1);
    expect(result.current.sentAt).not.toBeNull(); // only set after the server acks
    expect(result.current.sendError).toBeNull();
    // The queue drained, so nothing is left to retry.
    await waitFor(async () =>
      expect(await AsyncStorage.getItem("@vela/help_queue")).toBeNull()
    );
  });
});
