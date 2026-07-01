import { beforeEach, describe, expect, test } from "vitest";

import { focusableElements, trapFocus } from "../../static/src/utils/a11y.js";

describe("a11y focus trap", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  test("lists focusable descendants and skips hidden ones", () => {
    document.body.innerHTML = `
      <div id="container">
        <button id="first">First</button>
        <button id="hidden-btn" hidden>Hidden</button>
        <button class="hidden" id="css-hidden">CSS hidden</button>
        <input id="an-input" />
        <a id="a-link" href="#x">Link</a>
        <span id="not-focusable">Text</span>
      </div>
    `;
    const container = document.querySelector("#container");

    const focusable = focusableElements(container);

    expect(focusable.map((el) => el.id)).toEqual(["first", "an-input", "a-link"]);
  });

  test("wraps Tab from the last focusable element back to the first", () => {
    document.body.innerHTML = `
      <button id="trigger">Open</button>
      <div id="modal"><button id="first">First</button><button id="last">Last</button></div>
    `;
    const modal = document.querySelector("#modal");
    const last = document.querySelector("#last");
    const first = document.querySelector("#first");
    last.focus();

    trapFocus(modal);
    const event = new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true });
    last.dispatchEvent(event);

    expect(document.activeElement).toBe(first);
    expect(event.defaultPrevented).toBe(true);
  });

  test("wraps Shift+Tab from the first focusable element back to the last", () => {
    document.body.innerHTML = `
      <div id="modal"><button id="first">First</button><button id="last">Last</button></div>
    `;
    const modal = document.querySelector("#modal");
    const first = document.querySelector("#first");
    const last = document.querySelector("#last");
    first.focus();

    trapFocus(modal);
    const event = new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true, cancelable: true });
    first.dispatchEvent(event);

    expect(document.activeElement).toBe(last);
  });

  test("restores focus to the trigger element on release", () => {
    document.body.innerHTML = `
      <button id="trigger">Open</button>
      <div id="modal"><button id="inside">Inside</button></div>
    `;
    const trigger = document.querySelector("#trigger");
    const modal = document.querySelector("#modal");
    trigger.focus();

    const release = trapFocus(modal);
    document.querySelector("#inside").focus();
    release();

    expect(document.activeElement).toBe(trigger);
  });

  test("skips restoring focus when restoreFocus is false", () => {
    document.body.innerHTML = `
      <button id="trigger">Open</button>
      <div id="modal"><button id="inside">Inside</button></div>
    `;
    const trigger = document.querySelector("#trigger");
    const modal = document.querySelector("#modal");
    trigger.focus();

    const release = trapFocus(modal);
    const inside = document.querySelector("#inside");
    inside.focus();
    release({ restoreFocus: false });

    expect(document.activeElement).toBe(inside);
  });
});
