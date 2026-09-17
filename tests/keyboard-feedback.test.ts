import { describe, expect, it } from "vitest";
import { keyboardKeysForEvent } from "../apps/clone/src/keyboard-feedback.js";

describe("physical keyboard feedback mapping", () => {
  it("maps left and right modifiers to their matching source keys", () => {
    expect(keyboardKeysForEvent({ key: "Shift", code: "ShiftLeft" })).toEqual(["SHIFT"]);
    expect(keyboardKeysForEvent({ key: "Shift", code: "ShiftRight" })).toEqual(["SHIFT_RIGHT"]);
    expect(keyboardKeysForEvent({ key: "Control", code: "ControlRight" })).toEqual(["CTRL_RIGHT"]);
    expect(keyboardKeysForEvent({ key: "AltGraph", code: "AltRight" })).toEqual(["ALT GR"]);
  });

  it("maps source special keys and both halves of Enter", () => {
    expect(keyboardKeysForEvent({ key: "Enter", code: "Enter" })).toEqual(["ENTER", "ENTER_LOWER"]);
    expect(keyboardKeysForEvent({ key: "Backspace", code: "Backspace" })).toEqual(["BACK"]);
    expect(keyboardKeysForEvent({ key: "ArrowUp", code: "ArrowUp" })).toEqual(["↑"]);
    expect(keyboardKeysForEvent({ key: " ", code: "Space" })).toEqual(["SPACE"]);
  });

  it("preserves printable values so shifted labels can match the layout", () => {
    expect(keyboardKeysForEvent({ key: "q", code: "KeyQ" })).toEqual(["Q"]);
    expect(keyboardKeysForEvent({ key: "!", code: "Digit1" })).toEqual(["!"]);
    expect(keyboardKeysForEvent({ key: "?", code: "Slash" })).toEqual(["?"]);
  });
});
