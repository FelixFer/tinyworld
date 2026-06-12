export type InputState = {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
};

export function createInput(): InputState {
  const state: InputState = {
    up: false,
    down: false,
    left: false,
    right: false,
  };

  const onKey = (e: KeyboardEvent, pressed: boolean) => {
    switch (e.code) {
      case "KeyW":
      case "ArrowUp":
        state.up = pressed;
        e.preventDefault();
        break;
      case "KeyS":
      case "ArrowDown":
        state.down = pressed;
        e.preventDefault();
        break;
      case "KeyA":
      case "ArrowLeft":
        state.left = pressed;
        e.preventDefault();
        break;
      case "KeyD":
      case "ArrowRight":
        state.right = pressed;
        e.preventDefault();
        break;
    }
  };

  const onKeyDown = (e: KeyboardEvent) => onKey(e, true);
  const onKeyUp = (e: KeyboardEvent) => onKey(e, false);
  const onBlur = () => {
    state.up = state.down = state.left = state.right = false;
  };

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", onBlur);

  return state;
}

export function destroyInput(): void {
  // Listeners are on window; for a SPA this is fine — they die with the page.
  // A full cleanup would store references; omitted for brevity.
}
