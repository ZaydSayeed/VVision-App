import React from "react";
import { describe, it, expect } from "@jest/globals";
import { render, screen } from "@testing-library/react-native";
import { AppHeader } from "./AppHeader";

describe("AppHeader", () => {
  it("renders the Vela Vision brand", () => {
    render(<AppHeader onOpenDrawer={() => {}} user={null} />);
    expect(screen.getByText("Vela Vision")).toBeTruthy();
  });

  it("shows the notification badge + bell when there are notifications", () => {
    render(<AppHeader onOpenDrawer={() => {}} user={null} notifCount={3} onOpenNotif={() => {}} />);
    expect(screen.getByText("3")).toBeTruthy();
    expect(screen.getByLabelText("Notifications")).toBeTruthy();
  });
});
